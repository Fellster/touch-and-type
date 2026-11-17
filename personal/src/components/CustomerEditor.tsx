import {
  ArrowLeft,
  Copy,
  Phone,
  Mail,
  ListTodo,
  Mic,
  Square,
  Trash2,
  Camera,
  Upload,
} from "lucide-react";
import { customerNotes } from "../notes";
import { PhoneInput } from "../../../src/components/PhoneInput";
import Tags from "./Tags";
import MediaGallery from "./MediaGallery";
import type { Customer, Notebook } from "../model";
type Props = {
  draft: Customer;
  labels: Notebook["settings"]["labels"];
  change: (c: Customer) => void;
  saved: Customer | undefined;
  busy: boolean;
  listening: boolean;
  save: () => void;
  close: () => void;
  remove: () => void;
  todo: () => void;
  dictate: () => void;
  photo: () => void;
  camera: () => void;
  email: () => void;
  draw: () => void;
  media: Notebook["media"];
  deleteMedia: (id: string) => void;
  openImage: (url: string) => void;
  fields: Notebook["customFields"];
};
export default function CustomerEditor(p: Props) {
  const c = p.draft,
    dirty = JSON.stringify(c) !== JSON.stringify(p.saved);
  const update = (patch: Partial<Customer>) => p.change({ ...c, ...patch });
  return (
    <div className="editor-page">
      <div className="editor-toolbar">
        <button className="ghost" onClick={p.close} disabled={p.busy}>
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="actions">
          <button disabled={p.busy} onClick={p.close}>
            Done
          </button>
          {p.saved && (
            <button
              className="icon-button danger"
              aria-label="Delete customer"
              disabled={p.busy}
              onClick={p.remove}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Add to-do for this customer"
            onClick={p.todo}
            disabled={p.busy}
          >
            <ListTodo size={18} />
          </button>
        </div>
      </div>
      <input
        className="customer-heading-input"
        aria-label="Customer name"
        placeholder="Customer name"
        value={c.name}
        onChange={(e) => update({ name: e.target.value })}
      />
      <div className="save-row">
        {dirty && <span className="subtle">Unsaved changes</span>}
        <button
          className="primary"
          disabled={p.busy || p.listening || !dirty || !c.name.trim()}
          onClick={p.save}
        >
          {p.busy ? "Saving…" : "Save Changes"}
        </button>
      </div>
      <section className="card customer-fields">
        <label className="field">
          <span>Phone</span>
          <div className="contact-edit">
            <PhoneInput
              aria-label="Phone"
              value={c.phone}
              onValueChange={(phone) => update({ phone })}
            />
            <button
              className="icon-button"
              aria-label="Copy phone number"
              disabled={!c.phone}
              onClick={() =>
                void navigator.clipboard.writeText(c.phone).catch(() => {})
              }
            >
              <Copy size={17} />
            </button>
            <a
              className="icon-button"
              aria-label="Call phone number"
              href={"tel:" + c.phone.replace(/[^\d+]/g, "")}
            >
              <Phone size={17} />
            </a>
          </div>
        </label>
        <label className="field">
          <span>Email</span>
          <div className="contact-edit">
            <input
              type="email"
              aria-label="Email"
              value={c.email}
              onChange={(e) => update({ email: e.target.value })}
            />
            <button
              type="button"
              className="icon-button"
              aria-label="Send email"
              disabled={!c.email}
              onClick={p.email}
            >
              <Mail size={17} />
            </button>
          </div>
        </label>
        <div className="two-fields">
          <label className="field">
            <span>{p.labels.shoe_size}</span>
            <input
              aria-label={p.labels.shoe_size}
              inputMode="decimal"
              value={c.shoeSize}
              onChange={(e) => update({ shoeSize: e.target.value })}
            />
          </label>
          <label className="field">
            <span>{p.labels.width}</span>
            <select
              aria-label={p.labels.width}
              value={c.width}
              onChange={(e) => update({ width: e.target.value })}
            >
              <option value="">—</option>
              {["Narrow", "Medium", "Wide"].map((w) => (
                <option key={w}>{w}</option>
              ))}
              {c.width && !["Narrow", "Medium", "Wide"].includes(c.width) && (
                <option>{c.width}</option>
              )}
            </select>
          </label>
        </div>
        <Tags
          label={p.labels.designers}
          values={c.designers}
          onChange={(designers) => update({ designers })}
        />
        <Tags
          label={p.labels.looking_for}
          values={c.wants}
          onChange={(wants) => update({ wants })}
        />
        {Object.entries(c.custom).map(([key, value]) => (
          <label className="field" key={key}>
            <span>
              {String(
                p.fields.find((f) => f.key === key)?.label ??
                  key.replace(/_/g, " "),
              )}
            </span>
            {typeof value === "boolean" ? (
              <input
                type="checkbox"
                checked={value}
                aria-label={key}
                onChange={(e) =>
                  update({ custom: { ...c.custom, [key]: e.target.checked } })
                }
              />
            ) : typeof value === "string" ||
              typeof value === "number" ||
              value == null ? (
              <input
                aria-label={key}
                type={typeof value === "number" ? "number" : "text"}
                value={value == null ? "" : String(value)}
                onChange={(e) =>
                  update({
                    custom: {
                      ...c.custom,
                      [key]:
                        typeof value === "number"
                          ? e.target.value === ""
                            ? null
                            : Number(e.target.value)
                          : e.target.value,
                    },
                  })
                }
              />
            ) : (
              <p className="pre">{JSON.stringify(value)}</p>
            )}
          </label>
        ))}
      </section>
      <section>
        <div className="section-heading">
          <h2>
            <label htmlFor="customer-notes">Customer Notes</label>
          </h2>
          <button
            className="icon-button"
            aria-label={p.listening ? "Stop dictation" : "Dictate note"}
            disabled={p.busy}
            onClick={p.dictate}
          >
            {p.listening ? <Square size={18} /> : <Mic size={18} />}
          </button>
        </div>
        <textarea
          id="customer-notes"
          rows={6}
          placeholder="Type any notes here…"
          value={customerNotes(c)}
          onChange={(e) => update({ notes: e.target.value, personalNotes: "" })}
        />
      </section>
      {(["drawing", "photo"] as const).map((kind) => (
        <section key={kind}>
          <div className="section-heading">
            <h2>{kind === "drawing" ? "Drawings" : "Photos"}</h2>
            {kind === "drawing" ? (
              <button
                aria-label="Add new drawing"
                onClick={p.draw}
                disabled={p.busy}
                className="primary"
              >
                + New
              </button>
            ) : (
              <div className="photo-actions">
                <button
                  aria-label="Take photo"
                  onClick={p.camera}
                  disabled={p.busy}
                >
                  <Camera size={16} />
                  Take photo
                </button>
                <button
                  aria-label="Add photo"
                  onClick={p.photo}
                  disabled={p.busy}
                >
                  <Upload size={16} />
                  Upload
                </button>
              </div>
            )}
          </div>
          <MediaGallery
            items={p.media.filter((m) => m.kind === kind)}
            kind={kind}
            open={p.openImage}
            remove={p.deleteMedia}
            busy={p.busy}
          />
          {kind === "photo" && !p.media.some((m) => m.kind === "photo") && (
            <p className="subtle">
              Take a photo or upload one from your phone.
            </p>
          )}
        </section>
      ))}
      <div className="save-row">
        <button
          className="primary"
          disabled={p.busy || p.listening || !dirty || !c.name.trim()}
          onClick={p.save}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
