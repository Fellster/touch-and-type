import {
  useEffect,
  useRef,
  useState,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { Capacitor } from "@capacitor/core";
import { NotedLogo } from "../../src/components/NotedLogo";
import {
  startDictation,
  type SpeechSession,
} from "../../src/lib/voice/dictation";
import {
  emptyNotebook,
  deleteCustomer,
  type Customer,
  type Todo,
  type Notebook,
  MAX_BACKUP_BYTES,
} from "./model";
import {
  loadNotebook,
  saveNotebook,
  downloadBackup,
  deviceStore,
} from "./storage";
import { encodeBackup, decodeBackup } from "./backup";
import { photoData } from "./media";
const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const freshCustomer = (): Customer => ({
  id: newId(),
  name: "",
  phone: "",
  email: "",
  designers: [],
  shoeSize: "",
  width: "",
  wants: [],
  notes: "",
  personalNotes: "",
  custom: {},
  updatedAt: now(),
});
const split = (s: string) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
const names = {
  warm: "Warm Boutique",
  paper: "Paper",
  cubs: "Chicago Cubs",
  bears: "Chicago Bears",
  yankees: "New York Yankees",
};
const fonts = {
  inter: "Inter",
  lora: "Lora",
  manrope: "Manrope",
  kalam: "Kalam",
};
const fontFamily = {
  inter: "Inter",
  lora: "Lora",
  manrope: "Manrope",
  kalam: "Kalam",
};
const accents = {
  theme: "Theme",
  black: "Black",
  blue: "Blue",
  green: "Green",
  red: "Red",
};
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button aria-label="Close dialog" onClick={close}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, {
            "aria-label": label,
          })
        : children}
    </label>
  );
}
export default function App() {
  const [notebook, setNotebook] = useState<Notebook>(emptyNotebook);
  const current = useRef({ notebook: emptyNotebook(), revision: 0 });
  const lock = useRef(false);
  const [ready, setReady] = useState(false),
    [fatal, setFatal] = useState(""),
    [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"todo" | "customers" | "settings">("todo");
  const [selected, setSelected] = useState<string | null>(null),
    [query, setQuery] = useState("");
  const [sort, setSort] = useState("updated");
  const [customerDraft, setCustomerDraft] = useState<Customer | null>(null),
    [taskDraft, setTaskDraft] = useState<Todo | null>(null);
  const [restore, setRestore] = useState<Notebook | null>(null),
    [restoreBackedUp, setRestoreBackedUp] = useState(false);
  const [drawing, setDrawing] = useState(false),
    [picture, setPicture] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null),
    backupInput = useRef<HTMLInputElement>(null);
  const speech = useRef<SpeechSession | null>(null);
  const [listening, setListening] = useState(false);
  useEffect(() => {
    let active = true;
    loadNotebook()
      .then((snapshot) => {
        if (active) {
          current.current = snapshot;
          setNotebook(snapshot.notebook);
          setReady(true);
        }
      })
      .catch(() => {
        if (active)
          setFatal(
            "Your notebook could not be opened. Do not uninstall the app or clear its storage. Try restarting your phone.",
          );
      });
    return () => {
      active = false;
      speech.current?.cancel();
    };
  }, []);
  async function commit(change: (n: Notebook) => Notebook) {
    if (lock.current)
      throw new Error("Please wait for the current save to finish.");
    lock.current = true;
    setBusy(true);
    try {
      const next = change(current.current.notebook);
      const revision = await saveNotebook(next, current.current.revision);
      current.current = { notebook: next, revision };
      setNotebook(next);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function act(action: () => Promise<void>) {
    try {
      await action();
    } catch (e) {
      if (e instanceof Error && e.message === "Canceled") return;
      setMessage(
        e instanceof Error
          ? e.message
          : "Could not complete that action. Your saved records are preserved.",
      );
    }
  }
  const c = notebook.customers.find((c) => c.id === selected);
  const sortedTasks = [...notebook.todos].sort(
    (a, b) => Number(a.done) - Number(b.done) || a.position - b.position,
  );
  const tasks = selected
    ? sortedTasks.filter((t) => t.customerId === selected)
    : sortedTasks;
  const newTodo = (customerId: string | null = null) =>
    setTaskDraft({
      id: newId(),
      customerId,
      title: "",
      due: "",
      done: false,
      position: Math.max(-1, ...notebook.todos.map((t) => t.position)) + 1,
    });
  async function dictate(target: "task" | "notes") {
    if (speech.current) {
      speech.current.stop();
      return;
    }
    if (Capacitor.getPlatform() !== "android") {
      setMessage(
        "Use your keyboard microphone in this browser preview. The Android app uses on-device speech.",
      );
      return;
    }
    await act(async () => {
      setListening(true);
      try {
        const session = startDictation();
        speech.current = session;
        const text = await session.result;
        if (!text)
          throw new Error("No speech detected. Try again or type your entry.");
        if (target === "notes")
          setCustomerDraft((d) =>
            d ? { ...d, notes: [d.notes, text].filter(Boolean).join("\n") } : d,
          );
        else
          setTaskDraft((d) =>
            d ? { ...d, title: [d.title, text].filter(Boolean).join(" ") } : d,
          );
      } finally {
        speech.current = null;
        setListening(false);
      }
    });
  }
  function stopSpeech() {
    speech.current?.cancel();
  }
  async function readBackup(text: string) {
    setRestore(await decodeBackup(text));
    setRestoreBackedUp(false);
  }
  async function pickRestore() {
    if (Capacitor.getPlatform() === "android")
      await act(async () => readBackup((await deviceStore.importFile()).text));
    else backupInput.current?.click();
  }
  async function backup() {
    await downloadBackup(await encodeBackup(current.current.notebook));
  }
  async function addPhoto(file: File) {
    if (!c) return;
    const customerId = c.id;
    await act(async () => {
      const data = await photoData(file);
      await commit((n) => ({
        ...n,
        media: [
          ...n.media,
          {
            id: newId(),
            customerId,
            kind: "photo",
            name: file.name,
            data,
            text: "",
          },
        ],
      }));
      setMessage("Picture saved on this device.");
    });
  }
  function reorder(id: string, delta: number) {
    const ids = sortedTasks.map((t) => t.id),
      index = ids.indexOf(id),
      dest = index + delta;
    if (dest < 0 || dest >= ids.length) return;
    [ids[index], ids[dest]] = [ids[dest], ids[index]];
    void act(() =>
      commit((n) => ({
        ...n,
        todos: n.todos.map((t) => ({ ...t, position: ids.indexOf(t.id) })),
      })),
    );
  }
  if (fatal)
    return (
      <main>
        <h1>Noted Personal</h1>
        <p role="alert">{fatal}</p>
      </main>
    );
  if (!ready)
    return (
      <main>
        <p>Opening your notebook…</p>
      </main>
    );
  const s = notebook.settings;
  return (
    <div
      className="app"
      data-theme={s.theme}
      data-accent={s.accent}
      style={{ fontFamily: fontFamily[s.font] }}
    >
      <main>
        <header>
          <div className="brand">
            <NotedLogo />
            <div>
              <h1>
                Noted <small>Personal</small>
              </h1>
              <span className="subtle">Saved on this device</span>
            </div>
          </div>
          {selected && <button onClick={() => setSelected(null)}>Back</button>}
        </header>
        {!selected && (
          <nav aria-label="Main navigation">
            {(["todo", "customers", "settings"] as const).map((key) => (
              <button
                key={key}
                aria-current={tab === key ? "page" : undefined}
                onClick={() => {
                  setTab(key);
                  setQuery("");
                }}
              >
                {key === "todo"
                  ? "To-Do"
                  : key === "customers"
                    ? "Customers"
                    : "Settings"}
              </button>
            ))}
          </nav>
        )}
        {message && (
          <div className="notice" role="status">
            <span>{message}</span>
            <button aria-label="Dismiss message" onClick={() => setMessage("")}>
              ×
            </button>
          </div>
        )}
        {!Capacitor.isNativePlatform() && (
          <p className="preview-note">
            Browser test copy. It is separate from the Android notebook. Export
            a backup before clearing browser data.
          </p>
        )}
        {c ? (
          <>
            <div className="section-heading">
              <h2>{c.name}</h2>
              <button
                aria-label="Edit customer"
                disabled={busy}
                onClick={() => setCustomerDraft(structuredClone(c))}
              >
                ✎ Edit
              </button>
            </div>
            <section className="card details">
              {c.phone && <a href={"tel:" + c.phone}>{c.phone}</a>}
              {c.email && <a href={"mailto:" + c.email}>{c.email}</a>}
              {!!c.designers.length && (
                <p>
                  <strong>Designers</strong>
                  <br />
                  {c.designers.join(", ")}
                </p>
              )}
              {(c.shoeSize || c.width) && (
                <p>
                  <strong>Size / Width</strong>
                  <br />
                  {[c.shoeSize, c.width].filter(Boolean).join(" · ")}
                </p>
              )}
              {!!c.wants.length && (
                <p>
                  <strong>Wants</strong>
                  <br />
                  {c.wants.join(", ")}
                </p>
              )}
              {c.notes && (
                <p className="pre">
                  <strong>Customer Notes</strong>
                  <br />
                  {c.notes}
                </p>
              )}
              {c.personalNotes && (
                <p className="pre">
                  <strong>My Notes</strong>
                  <br />
                  {c.personalNotes}
                </p>
              )}
              {Object.keys(c.custom).length > 0 && (
                <details>
                  <summary>Additional information</summary>
                  <pre>{JSON.stringify(c.custom, null, 2)}</pre>
                </details>
              )}
            </section>
            <div className="section-heading">
              <h3>Pictures & Drawings</h3>
              <div className="actions">
                <button
                  disabled={busy}
                  onClick={() => photoInput.current?.click()}
                >
                  + Picture
                </button>
                <button disabled={busy} onClick={() => setDrawing(true)}>
                  + Drawing
                </button>
              </div>
            </div>
            <div className="gallery">
              {notebook.media
                .filter((m) => m.customerId === c.id)
                .map((m) => (
                  <article className="card" key={m.id}>
                    <button
                      className="picture-button"
                      aria-label={"Open " + m.kind}
                      onClick={() => setPicture(m.data)}
                    >
                      <img src={m.data} alt={m.name || m.kind} />
                    </button>
                    {m.text && <p className="pre">{m.text}</p>}
                    <button
                      className="danger"
                      disabled={busy}
                      onClick={() => {
                        if (confirm("Delete this " + m.kind + "?"))
                          void act(() =>
                            commit((n) => ({
                              ...n,
                              media: n.media.filter((x) => x.id !== m.id),
                            })),
                          );
                      }}
                    >
                      Delete
                    </button>
                  </article>
                ))}
            </div>
          </>
        ) : tab === "customers" ? (
          <>
            <div className="section-heading">
              <h2>Customers</h2>
              <button
                className="primary"
                disabled={busy}
                onClick={() => setCustomerDraft(freshCustomer())}
              >
                + Add customer
              </button>
            </div>
            <Field label="Search">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, designer, size, notes…"
              />
            </Field>
            <Field label="Sort">
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="updated">Recently updated</option>
                <option value="az">A–Z</option>
                <option value="za">Z–A</option>
              </select>
            </Field>
            {!notebook.customers.length && (
              <p>
                Your notebook is ready. Add a customer, or restore your copy
                from the online app in Settings.
              </p>
            )}
            {notebook.customers
              .filter((c) =>
                [
                  c.name,
                  c.phone,
                  c.email,
                  c.notes,
                  c.personalNotes,
                  c.shoeSize,
                  c.width,
                  ...c.designers,
                  ...c.wants,
                ]
                  .join(" ")
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .sort((a, b) =>
                sort === "updated"
                  ? b.updatedAt.localeCompare(a.updatedAt)
                  : (sort === "za" ? -1 : 1) * a.name.localeCompare(b.name),
              )
              .map((c) => (
                <button
                  className="card customer-row"
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                >
                  <strong>{c.name}</strong>
                  <span className="subtle">
                    {[c.phone, ...c.designers, c.shoeSize]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              ))}
          </>
        ) : null}
        {(c || tab === "todo") && (
          <>
            <div className="section-heading">
              <h2>{c ? "To-Dos" : "To-Do"}</h2>
              <div className="actions">
                {!c && (
                  <button
                    disabled={busy}
                    onClick={() => setCustomerDraft(freshCustomer())}
                  >
                    + Add customer
                  </button>
                )}
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => newTodo(c?.id ?? null)}
                >
                  + Add
                </button>
              </div>
            </div>
            {!tasks.length && <p>No to-dos yet.</p>}
            {tasks.map((t) => (
              <article
                key={t.id}
                className={"card task " + (t.done ? "done" : "")}
              >
                <input
                  type="checkbox"
                  aria-label={"Complete " + t.title}
                  checked={t.done}
                  disabled={busy}
                  onChange={() =>
                    void act(() =>
                      commit((n) => ({
                        ...n,
                        todos: n.todos.map((x) =>
                          x.id === t.id ? { ...x, done: !x.done } : x,
                        ),
                      })),
                    )
                  }
                />
                <div className="task-text">
                  <button
                    className="text-button"
                    onClick={() => setTaskDraft({ ...t })}
                  >
                    {t.title}
                  </button>
                  {t.customerId && (
                    <button
                      className="text-button subtle"
                      onClick={() => setSelected(t.customerId)}
                    >
                      {
                        notebook.customers.find((c) => c.id === t.customerId)
                          ?.name
                      }
                    </button>
                  )}
                  {t.due && (
                    <span className="subtle">
                      {new Date(t.due).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="order-buttons">
                  <button
                    aria-label={"Move up " + t.title}
                    disabled={busy || sortedTasks[0].id === t.id || !!c}
                    onClick={() => reorder(t.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={"Move down " + t.title}
                    disabled={busy || sortedTasks.at(-1)?.id === t.id || !!c}
                    onClick={() => reorder(t.id, 1)}
                  >
                    ↓
                  </button>
                </div>
              </article>
            ))}
          </>
        )}
        {!selected && tab === "settings" && (
          <>
            <h2>Settings</h2>
            <section className="card settings">
              <Field label="Themes">
                <select
                  value={s.theme}
                  disabled={busy}
                  onChange={(e) =>
                    void act(() =>
                      commit((n) => ({
                        ...n,
                        settings: {
                          ...n.settings,
                          theme: e.target.value as typeof s.theme,
                        },
                      })),
                    )
                  }
                >
                  {Object.entries(names).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Highlight color">
                <select
                  value={s.accent}
                  disabled={busy}
                  onChange={(e) =>
                    void act(() =>
                      commit((n) => ({
                        ...n,
                        settings: {
                          ...n.settings,
                          accent: e.target.value as typeof s.accent,
                        },
                      })),
                    )
                  }
                >
                  {Object.entries(accents).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fonts">
                <select
                  value={s.font}
                  disabled={busy}
                  onChange={(e) =>
                    void act(() =>
                      commit((n) => ({
                        ...n,
                        settings: {
                          ...n.settings,
                          font: e.target.value as typeof s.font,
                        },
                      })),
                    )
                  }
                >
                  {Object.entries(fonts).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </section>
            <h3>Backup & Restore</h3>
            <section className="card">
              <p>
                A backup includes customers, to-dos, pictures, drawings, and
                settings. Save a copy outside the app before changing phones or
                uninstalling.
              </p>
              <p className="subtle">
                Backup files contain private customer information and are not
                encrypted. Choose a location you control.
              </p>
              <div className="actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await backup();
                      setMessage(
                        "Backup export completed. Keep it somewhere safe.",
                      );
                    })
                  }
                >
                  Save backup
                </button>
                <button disabled={busy} onClick={() => void pickRestore()}>
                  Restore backup
                </button>
              </div>
              <p className="subtle">
                {notebook.customers.length} customers · {notebook.todos.length}{" "}
                to-dos · {notebook.media.length} pictures/drawings
              </p>
            </section>
            <section className="card">
              <h3>Voice</h3>
              <p>
                Use the microphone while editing notes or adding a to-do. Review
                before saving. On-device language support must be available on
                your phone. Dates are selected manually.
              </p>
              <h3>AI assistants</h3>
              <p>
                ChatGPT, Gemini, and Claude are not connected yet. Your notebook
                does not send them customer information.
              </p>
            </section>
          </>
        )}
        <input
          hidden
          ref={photoInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void addPhoto(file);
            e.target.value = "";
          }}
        />
        <input
          hidden
          ref={backupInput}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              void act(async () => {
                if (file.size > MAX_BACKUP_BYTES)
                  throw new Error("Backup exceeds the 64 MB limit.");
                await readBackup(await file.text());
              });
            e.target.value = "";
          }}
        />
        {customerDraft && (
          <Modal
            title={
              notebook.customers.some((c) => c.id === customerDraft.id)
                ? "Edit customer"
                : "Add customer"
            }
            close={() => {
              if (!busy) {
                stopSpeech();
                setCustomerDraft(null);
              }
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  const draft = {
                    ...customerDraft,
                    name: customerDraft.name.trim(),
                    updatedAt: now(),
                  };
                  await commit((n) => ({
                    ...n,
                    customers: [
                      ...n.customers.filter((c) => c.id !== draft.id),
                      draft,
                    ],
                  }));
                  setSelected(draft.id);
                  stopSpeech();
                  setCustomerDraft(null);
                });
              }}
            >
              <Field label="Name">
                <input
                  autoFocus
                  required
                  maxLength={300}
                  value={customerDraft.name}
                  onChange={(e) =>
                    setCustomerDraft({ ...customerDraft, name: e.target.value })
                  }
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={customerDraft.phone}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const d = raw.replace(/\D/g, "");
                    setCustomerDraft({
                      ...customerDraft,
                      phone:
                        /^[\d ()-]*$/.test(raw) && d.length <= 10
                          ? [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)]
                              .filter(Boolean)
                              .join("-")
                          : raw,
                    });
                  }}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={customerDraft.email}
                  onChange={(e) =>
                    setCustomerDraft({
                      ...customerDraft,
                      email: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Designers (comma-separated)">
                <input
                  value={customerDraft.designers.join(", ")}
                  onChange={(e) =>
                    setCustomerDraft({
                      ...customerDraft,
                      designers: e.target.value.split(","),
                    })
                  }
                  onBlur={() =>
                    setCustomerDraft({
                      ...customerDraft,
                      designers: split(customerDraft.designers.join(",")),
                    })
                  }
                />
              </Field>
              <div className="two-fields">
                <Field label="Shoe size">
                  <input
                    value={customerDraft.shoeSize}
                    onChange={(e) =>
                      setCustomerDraft({
                        ...customerDraft,
                        shoeSize: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Width">
                  <input
                    value={customerDraft.width}
                    onChange={(e) =>
                      setCustomerDraft({
                        ...customerDraft,
                        width: e.target.value,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Wants (comma-separated)">
                <input
                  value={customerDraft.wants.join(", ")}
                  onChange={(e) =>
                    setCustomerDraft({
                      ...customerDraft,
                      wants: e.target.value.split(","),
                    })
                  }
                  onBlur={() =>
                    setCustomerDraft({
                      ...customerDraft,
                      wants: split(customerDraft.wants.join(",")),
                    })
                  }
                />
              </Field>
              <Field label="Customer Notes">
                <textarea
                  rows={5}
                  value={customerDraft.notes}
                  onChange={(e) =>
                    setCustomerDraft({
                      ...customerDraft,
                      notes: e.target.value,
                    })
                  }
                />
              </Field>
              <button
                type="button"
                disabled={busy}
                onClick={() => void dictate("notes")}
              >
                {listening ? "Stop dictation" : "Microphone"}
              </button>
              <Field label="My Notes">
                <textarea
                  rows={3}
                  value={customerDraft.personalNotes}
                  onChange={(e) =>
                    setCustomerDraft({
                      ...customerDraft,
                      personalNotes: e.target.value,
                    })
                  }
                />
              </Field>
              <p role="alert">{message}</p>
              <div className="actions footer">
                <button
                  className="primary"
                  disabled={busy || listening || !customerDraft.name.trim()}
                >
                  Save customer
                </button>
                {notebook.customers.some((c) => c.id === customerDraft.id) && (
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          "Delete this customer and their to-dos, pictures, and drawings?",
                        )
                      )
                        void act(async () => {
                          await commit((n) =>
                            deleteCustomer(n, customerDraft.id),
                          );
                          setCustomerDraft(null);
                          setSelected(null);
                        });
                    }}
                  >
                    Delete customer
                  </button>
                )}
              </div>
            </form>
          </Modal>
        )}
        {taskDraft && (
          <Modal
            title="To-do"
            close={() => {
              if (!busy) {
                stopSpeech();
                setTaskDraft(null);
              }
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  const draft = { ...taskDraft, title: taskDraft.title.trim() };
                  const old = notebook.todos.find((t) => t.id === draft.id);
                  await commit((n) => ({
                    ...n,
                    todos: [...n.todos.filter((t) => t.id !== draft.id), draft],
                  }));
                  if (old?.due !== draft.due && old)
                    setMessage("To-do rescheduled. Update your calendar");
                  setTaskDraft(null);
                  stopSpeech();
                });
              }}
            >
              <Field label="To-do">
                <textarea
                  autoFocus
                  required
                  rows={3}
                  value={taskDraft.title}
                  onChange={(e) =>
                    setTaskDraft({ ...taskDraft, title: e.target.value })
                  }
                />
              </Field>
              <button type="button" onClick={() => void dictate("task")}>
                {listening ? "Stop dictation" : "Microphone"}
              </button>
              <Field label="Customer">
                <select
                  value={taskDraft.customerId ?? ""}
                  onChange={(e) =>
                    setTaskDraft({
                      ...taskDraft,
                      customerId: e.target.value || null,
                    })
                  }
                >
                  <option value="">No customer</option>
                  {notebook.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date & time">
                <input
                  type="datetime-local"
                  value={taskDraft.due ? toLocal(taskDraft.due) : ""}
                  onChange={(e) =>
                    setTaskDraft({
                      ...taskDraft,
                      due: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : "",
                    })
                  }
                />
              </Field>
              <p role="alert">{message}</p>
              <div className="actions footer">
                <button
                  className="primary"
                  disabled={busy || listening || !taskDraft.title.trim()}
                >
                  Save to-do
                </button>
                {notebook.todos.some((t) => t.id === taskDraft.id) && (
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    onClick={() => {
                      if (confirm("Delete this to-do?"))
                        void act(async () => {
                          await commit((n) => ({
                            ...n,
                            todos: n.todos.filter((t) => t.id !== taskDraft.id),
                          }));
                          setTaskDraft(null);
                        });
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </form>
          </Modal>
        )}
        {restore && (
          <Modal
            title="Restore notebook"
            close={() => {
              if (!busy) setRestore(null);
            }}
          >
            <p>
              This backup contains {restore.customers.length} customers,{" "}
              {restore.todos.length} to-dos, and {restore.media.length}{" "}
              pictures/drawings.
            </p>
            <p>
              Restoring replaces this app's notebook. It does not change the
              online app.
            </p>
            {!restoreBackedUp && (
              <button
                onClick={() =>
                  void act(async () => {
                    await backup();
                    setRestoreBackedUp(true);
                  })
                }
              >
                Back up current notebook first
              </button>
            )}
            <button
              className="primary"
              disabled={
                busy ||
                (!restoreBackedUp &&
                  !!(
                    notebook.customers.length +
                    notebook.todos.length +
                    notebook.media.length
                  ))
              }
              onClick={() =>
                void act(async () => {
                  await commit(() => restore);
                  setRestore(null);
                  setSelected(null);
                  setMessage("Notebook restored.");
                })
              }
            >
              Replace notebook
            </button>
          </Modal>
        )}
        {drawing && c && (
          <Drawing
            close={() => setDrawing(false)}
            save={async (data) => {
              await commit((n) => ({
                ...n,
                media: [
                  ...n.media,
                  {
                    id: newId(),
                    customerId: c.id,
                    kind: "drawing",
                    name: "Drawing",
                    data,
                    text: "",
                  },
                ],
              }));
              setDrawing(false);
            }}
            report={setMessage}
          />
        )}
        {picture && (
          <Modal title="Picture" close={() => setPicture(null)}>
            <img
              className="full-picture"
              src={picture}
              alt="Customer reference"
            />
          </Modal>
        )}
      </main>
    </div>
  );
}
function toLocal(value: string) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function Drawing({
  close,
  save,
  report,
}: {
  close: () => void;
  save: (data: string) => Promise<void>;
  report: (text: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    down = useRef(false);
  const [saving, setSaving] = useState(false);
  const clear = () => {
    const c = canvas.current;
    if (c) {
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
    }
  };
  useEffect(clear, []);
  return (
    <Modal
      title="Drawing"
      close={() => {
        if (!saving) close();
      }}
    >
      <canvas
        aria-label="Draw with your finger"
        className="drawing"
        ref={canvas}
        width={600}
        height={600}
        onPointerDown={(e) => {
          down.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const box = e.currentTarget.getBoundingClientRect();
          const ctx = e.currentTarget.getContext("2d")!;
          ctx.beginPath();
          ctx.moveTo(
            ((e.clientX - box.left) * 600) / box.width,
            ((e.clientY - box.top) * 600) / box.height,
          );
        }}
        onPointerMove={(e) => {
          if (!down.current) return;
          const box = e.currentTarget.getBoundingClientRect();
          const ctx = e.currentTarget.getContext("2d")!;
          ctx.strokeStyle = "#222";
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.lineTo(
            ((e.clientX - box.left) * 600) / box.width,
            ((e.clientY - box.top) * 600) / box.height,
          );
          ctx.stroke();
        }}
        onPointerUp={() => {
          down.current = false;
        }}
        onPointerCancel={() => {
          down.current = false;
        }}
      />
      <div className="actions">
        <button disabled={saving} onClick={clear}>
          Clear
        </button>
        <button
          className="primary"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await save(canvas.current!.toDataURL("image/png"));
            } catch (e) {
              report(
                e instanceof Error ? e.message : "Could not save drawing.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          Save drawing
        </button>
      </div>
    </Modal>
  );
}
