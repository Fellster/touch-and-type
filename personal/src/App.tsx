import {
  useEffect,
  useRef,
  useState,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  NotebookPen,
  Settings,
  ArrowLeft,
  Search,
  Plus,
  Pencil,
  ListTodo,
  Mic,
  Square,
  ArrowUpDown,
} from "lucide-react";
import { applyTheme } from "./themes";
import { orderedTasks } from "./taskOrder";
import TaskBoard from "./components/TaskBoard";
import CustomerRead from "./components/CustomerRead";
import CustomerEditor from "./components/CustomerEditor";
import QuickCustomer from "./components/QuickCustomer";
import Appearance from "./components/Appearance";
import FieldNames from "./components/FieldNames";
import { Capacitor } from "@capacitor/core";
import NotedLogo from "./components/PersonalLogo";
import { openCalendar, openEmail } from "./integrations";
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
  const [tab, setTab] = useState<
    "todo" | "customers" | "settings" | "designers"
  >("todo");
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
    cameraInput = useRef<HTMLInputElement>(null),
    backupInput = useRef<HTMLInputElement>(null);
  const speech = useRef<SpeechSession | null>(null);
  const [listening, setListening] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [quickTitle, setQuickTitle] = useState(""),
    [quickDue, setQuickDue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Todo | null>(null),
    [deleteCustomerId, setDeleteCustomerId] = useState("");
  const [inlineListening, setInlineListening] = useState(false);
  useEffect(() => {
    applyTheme(
      notebook.settings.theme,
      notebook.settings.accent,
      notebook.settings.font,
    );
  }, [notebook.settings]);

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
    ? sortedTasks.filter(
        (t) =>
          t.customerId === selected ||
          (!t.customerId &&
            c &&
            t.title
              .split("\n")
              .some(
                (line) =>
                  line.trim().toLowerCase() === c.name.trim().toLowerCase(),
              )),
      )
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
  async function dictate(target: "task" | "notes" | "quick") {
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
        else if (target === "quick")
          setQuickTitle((value) => [value, text].filter(Boolean).join(" "));
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
  async function backup(destination: "phone" | "drive" = "phone") {
    await downloadBackup(
      await encodeBackup(current.current.notebook),
      destination,
    );
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
      className={
        "app" + (tab === "settings" && !selected ? " settings-page" : "")
      }
      data-theme={s.theme}
      data-accent={s.accent}
    >
      <main>
        {!customerDraft && (
          <header className={c ? "record-header" : "page-header"}>
            <div className="top-actions">
              {(c || tab !== "todo") && (
                <button
                  className="icon-button back-button"
                  aria-label="Back"
                  onClick={() => {
                    setSelected(null);
                    setTab("todo");
                    setAddingCustomer(false);
                  }}
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              {c ? (
                <>
                  <button
                    className="icon-button"
                    aria-label="Edit customer"
                    disabled={busy}
                    onClick={() => {
                      setMessage("");
                      setCustomerDraft(structuredClone(c));
                    }}
                  >
                    <Pencil size={20} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Add to-do for this customer"
                    disabled={busy}
                    onClick={() => newTodo(c.id)}
                  >
                    <ListTodo size={20} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="icon-button"
                    aria-label="Customer notebook"
                    onClick={() => {
                      setTab("customers");
                      setQuery("");
                    }}
                  >
                    <NotebookPen size={20} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Settings"
                    onClick={() => setTab("settings")}
                  >
                    <Settings size={20} />
                  </button>
                </>
              )}
            </div>
            {!c && (
              <>
                <div className="brand">
                  <NotedLogo />
                  <h1>
                    {tab === "todo"
                      ? "To-Do"
                      : tab === "customers"
                        ? "Customers"
                        : tab === "designers"
                          ? notebook.settings.labels.designers
                          : "Settings"}
                  </h1>
                </div>
                <p className="subtle">
                  {tab === "todo"
                    ? notebook.todos.filter((t) => !t.done).length +
                      " open · " +
                      notebook.todos.filter((t) => t.done).length +
                      " done"
                    : tab === "customers"
                      ? notebook.customers.length + " customers"
                      : "Noted Personal"}
                </p>
              </>
            )}
          </header>
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
        {customerDraft ? (
          <CustomerEditor
            draft={customerDraft}
            labels={notebook.settings.labels}
            change={setCustomerDraft}
            saved={notebook.customers.find((c) => c.id === customerDraft.id)}
            busy={busy}
            listening={listening}
            error={message}
            close={() => {
              if (
                JSON.stringify(customerDraft) !==
                  JSON.stringify(
                    notebook.customers.find((c) => c.id === customerDraft.id),
                  ) &&
                !confirm("Discard unsaved changes?")
              )
                return;
              stopSpeech();
              setCustomerDraft(null);
            }}
            save={() =>
              void act(async () => {
                if (!customerDraft.name.trim())
                  throw new Error("Enter a customer name.");
                const draft = {
                  ...customerDraft,
                  name: customerDraft.name.trim(),
                  updatedAt: now(),
                };
                await commit((n) => ({
                  ...n,
                  customers: n.customers.map((c) =>
                    c.id === draft.id ? draft : c,
                  ),
                }));
                setCustomerDraft(draft);
                setMessage("Customer changes saved");
              })
            }
            remove={() => {
              if (
                confirm(
                  "Delete this customer and their to-dos, pictures, and drawings?",
                )
              )
                void act(async () => {
                  await commit((n) => deleteCustomer(n, customerDraft.id));
                  setCustomerDraft(null);
                  setSelected(null);
                  setTab("customers");
                });
            }}
            todo={() => newTodo(customerDraft.id)}
            dictate={() => void dictate("notes")}
            photo={() => photoInput.current?.click()}
            camera={() => cameraInput.current?.click()}
            email={() => void act(() => openEmail(customerDraft.email))}
            draw={() => setDrawing(true)}
            media={notebook.media.filter(
              (m) => m.customerId === customerDraft.id,
            )}
            fields={notebook.customFields}
            openImage={setPicture}
            deleteMedia={(id) => {
              if (confirm("Delete this picture or drawing?"))
                void act(() =>
                  commit((n) => ({
                    ...n,
                    media: n.media.filter((m) => m.id !== id),
                  })),
                );
            }}
          />
        ) : c ? (
          <CustomerRead
            labels={notebook.settings.labels}
            photo={() => photoInput.current?.click()}
            camera={() => cameraInput.current?.click()}
            email={() => void act(() => openEmail(c.email))}
            busy={busy}
            customer={c}
            media={notebook.media.filter((m) => m.customerId === c.id)}
            fields={notebook.customFields}
            openImage={setPicture}
          />
        ) : tab === "customers" ? (
          <>
            <div className="customer-list-actions">
              <button
                className="primary"
                disabled={busy}
                onClick={() => {
                  setMessage("");
                  setAddingCustomer((value) => !value);
                }}
              >
                <Plus size={16} />
                Add customer
              </button>
            </div>
            {addingCustomer && (
              <QuickCustomer
                busy={busy}
                cancel={() => setAddingCustomer(false)}
                save={async (name, phone, email) => {
                  await act(async () => {
                    const draft = { ...freshCustomer(), name, phone, email };
                    await commit((n) => ({
                      ...n,
                      customers: [...n.customers, draft],
                    }));
                    setAddingCustomer(false);
                    setSelected(draft.id);
                    setCustomerDraft(draft);
                    setMessage("");
                  });
                }}
              />
            )}
            <div className="search-field">
              <Search size={16} />
              <input
                aria-label="Search customers"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, phone, email, designer, or looking for"
              />
            </div>
            <div className="sort-row">
              <ArrowUpDown size={16} />
              <select
                aria-label="Sort customers"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="updated">Recently Updated</option>
                <option value="az">Customers A–Z</option>
                <option value="za">Customers Z–A</option>
              </select>
            </div>
            {!notebook.customers.length && (
              <p className="empty-state">
                No customers yet. Add your first customer above.
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
                <article className="card customer-row" key={c.id}>
                  <button
                    className="customer-summary"
                    onClick={() => setSelected(c.id)}
                  >
                    <strong>{c.name}</strong>
                    <span className="subtle">
                      {[
                        ...c.designers,
                        c.wants.length
                          ? notebook.settings.labels.looking_for +
                            ": " +
                            c.wants.join(" · ")
                          : "",
                        c.shoeSize
                          ? notebook.settings.labels.shoe_size +
                            " " +
                            c.shoeSize
                          : "",
                        c.phone || c.email,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                  <button
                    className="icon-button"
                    aria-label={"Edit " + c.name}
                    onClick={() => {
                      setSelected(c.id);
                      setMessage("");
                      setCustomerDraft(structuredClone(c));
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                </article>
              ))}
          </>
        ) : tab === "designers" ? (
          <>
            <div className="search-field">
              <Search size={16} />
              <input
                aria-label={
                  "Search " + notebook.settings.labels.designers.toLowerCase()
                }
                placeholder={
                  "Search " +
                  notebook.settings.labels.designers.toLowerCase() +
                  "…"
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {[...new Set(notebook.customers.flatMap((c) => c.designers))]
              .filter((d) => d.toLowerCase().includes(query.toLowerCase()))
              .sort((a, b) => a.localeCompare(b))
              .map((d) => (
                <section key={d}>
                  <h2>{d}</h2>
                  {notebook.customers
                    .filter((c) => c.designers.includes(d))
                    .map((c) => (
                      <button
                        key={c.id}
                        className="card customer-row"
                        onClick={() => setSelected(c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                </section>
              ))}
          </>
        ) : null}
        {!customerDraft && (c || tab === "todo") && (
          <>
            {!c && (
              <>
                <form
                  className="quick-task"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!quickTitle.trim()) return;
                    void act(async () => {
                      const task: Todo = {
                        id: newId(),
                        customerId: null,
                        title: quickTitle.trim(),
                        due: quickDue ? new Date(quickDue).toISOString() : "",
                        done: false,
                        position:
                          Math.max(
                            -1,
                            ...notebook.todos.map((t) => t.position),
                          ) + 1,
                      };
                      await commit((n) => ({
                        ...n,
                        todos: [...n.todos, task],
                      }));
                      setQuickTitle("");
                      setQuickDue("");
                    });
                  }}
                >
                  <input
                    aria-label="New task"
                    value={quickTitle}
                    placeholder="What needs doing?"
                    onChange={(e) => setQuickTitle(e.target.value)}
                  />
                  <div className="quick-task-controls">
                    <input
                      type="datetime-local"
                      aria-label="Due date and time"
                      value={quickDue}
                      onChange={(e) => setQuickDue(e.target.value)}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={
                        listening ? "Stop dictation" : "Add task by voice"
                      }
                      onClick={() => void dictate("quick")}
                    >
                      {listening ? <Square size={18} /> : <Mic size={18} />}
                    </button>
                    <button
                      className="primary"
                      disabled={busy || listening || !quickTitle.trim()}
                    >
                      <Plus size={16} />
                      Add
                    </button>
                  </div>
                </form>
                <div className="home-shortcuts">
                  <button
                    onClick={() => {
                      setTab("customers");
                      setAddingCustomer(true);
                      setMessage("");
                    }}
                  >
                    <Plus size={15} />
                    Add customer
                  </button>
                  <button
                    onClick={() => {
                      setTab("designers");
                      setQuery("");
                    }}
                  >
                    <Search size={15} />
                    {notebook.settings.labels.designers === "Designers"
                      ? "Designer"
                      : notebook.settings.labels.designers}
                  </button>
                  <button
                    onClick={() => {
                      setTab("customers");
                      setQuery("");
                    }}
                  >
                    <NotebookPen size={15} />
                    Customers
                  </button>
                </div>
              </>
            )}
            {!tasks.length && (
              <p className="empty-state">
                {c
                  ? "No to-dos for this customer yet."
                  : "Nothing yet. Add your first task above."}
              </p>
            )}
            <TaskBoard
              todos={tasks}
              customers={notebook.customers}
              calendar={(task, customer) =>
                void act(async () => {
                  await openCalendar(task, customer);
                  setMessage(
                    "Calendar draft opened. Save the event and choose a reminder in your calendar.",
                  );
                })
              }
              busy={busy}
              openCustomer={setSelected}
              saveTitle={(t, title) =>
                commit((n) => ({
                  ...n,
                  todos: n.todos.map((x) =>
                    x.id === t.id ? { ...x, title } : x,
                  ),
                }))
              }
              toggle={(t) =>
                void act(() =>
                  commit((n) => ({
                    ...n,
                    todos: n.todos.map((x) =>
                      x.id === t.id ? { ...x, done: !x.done } : x,
                    ),
                  })),
                )
              }
              due={(t, due) =>
                void act(async () => {
                  await commit((n) => ({
                    ...n,
                    todos: n.todos.map((x) =>
                      x.id === t.id ? { ...x, due } : x,
                    ),
                  }));
                  setMessage("To-do rescheduled. Update your calendar");
                })
              }
              remove={(t) => {
                setPendingDelete(t);
                setDeleteCustomerId(t.customerId ?? "");
              }}
              reorder={(ids) =>
                commit((n) => ({ ...n, todos: orderedTasks(n.todos, ids) }))
              }
            />
          </>
        )}
        {!selected && tab === "settings" && (
          <>
            <Appearance
              settings={s}
              busy={busy}
              change={(settings) =>
                void act(() => commit((n) => ({ ...n, settings })))
              }
            />
            <FieldNames
              labels={s.labels}
              busy={busy}
              save={(labels) =>
                commit((n) => ({ ...n, settings: { ...n.settings, labels } }))
              }
            />
            <h3>Backup & Restore</h3>
            <section className="card">
              <p>
                A backup includes customers, to-dos, pictures, drawings, and
                settings. Save a copy outside the app before changing phones or
                uninstalling.
              </p>
              <p className="subtle">
                Back up to phone creates a file on your phone. Google Drive
                backup opens the location picker; choose your Drive folder and
                tap Save. Restore backup can open either copy.
              </p>
              <p className="subtle">
                Backup files contain private customer information and are not
                encrypted. Choose a location you control.
              </p>
              <div className="backup-actions">
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
                  Back up to phone
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await backup("drive");
                      setMessage(
                        "Backup file saved to the selected location. Check Google Drive to confirm its upload has completed.",
                      );
                    })
                  }
                >
                  Back up to Google Drive
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
              <h3>Google services</h3>
              <p>
                Tap the calendar icon on a scheduled to-do to open a Google
                Calendar event draft. Tap a customer’s email to compose in
                Gmail. You review and save or send in those apps.
              </p>
              <p className="subtle">
                Calendar events are separate copies. If you reschedule or delete
                a to-do, update your calendar too. Drive needs the Google Drive
                app and an internet connection to finish uploading. Your
                notebook and phone backups work offline.
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
        <input
          hidden
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Take customer photo"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void addPhoto(file);
            e.target.value = "";
          }}
        />
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
        {pendingDelete && (
          <Modal
            title="Delete task"
            close={() => {
              if (!busy) setPendingDelete(null);
            }}
          >
            <p>Save this task to a customer's notes before deleting it?</p>
            <div className="card pre">{pendingDelete.title}</div>
            <p className="subtle">
              If you added this to your calendar, remove that event there too.
            </p>
            <Field label="Customer">
              <select
                value={deleteCustomerId}
                onChange={(e) => setDeleteCustomerId(e.target.value)}
              >
                <option value="">Choose a customer</option>
                {notebook.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="actions">
              <button
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await commit((n) => ({
                      ...n,
                      todos: n.todos.filter((t) => t.id !== pendingDelete.id),
                    }));
                    setPendingDelete(null);
                  })
                }
              >
                Delete without saving
              </button>
              <button
                className="primary"
                disabled={busy || !deleteCustomerId}
                onClick={() =>
                  void act(async () => {
                    await commit((n) => ({
                      ...n,
                      customers: n.customers.map((c) =>
                        c.id === deleteCustomerId
                          ? {
                              ...c,
                              notes: [c.notes, pendingDelete.title]
                                .filter(Boolean)
                                .join("\n"),
                              updatedAt: now(),
                            }
                          : c,
                      ),
                      todos: n.todos.filter((t) => t.id !== pendingDelete.id),
                    }));
                    setPendingDelete(null);
                  })
                }
              >
                Save to notes & delete
              </button>
            </div>
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
