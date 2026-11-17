import { useEffect, useState } from "react";
import { DEFAULT_LABELS, type FieldKey } from "../../../src/hooks/useSettings";

type Labels = Record<FieldKey, string>;
export default function FieldNames({
  labels,
  busy,
  save,
}: {
  labels: Labels;
  busy: boolean;
  save: (labels: Labels) => Promise<void>;
}) {
  const [draft, setDraft] = useState(labels),
    [error, setError] = useState("");
  useEffect(() => setDraft(labels), [labels]);
  const keys = Object.keys(DEFAULT_LABELS) as FieldKey[];
  const valid = keys.every(
    (k) => draft[k].trim().length > 0 && draft[k].trim().length <= 40,
  );
  const dirty = keys.some((k) => draft[k] !== labels[k]);
  const persist = async (next: Labels) => {
    setError("");
    try {
      await save(next);
    } catch {
      setError("Could not save field names. Your changes are still here.");
    }
  };
  return (
    <section className="field-names">
      <div className="section-heading">
        <h2>Field names</h2>
        <button
          aria-label="Reset field names"
          disabled={busy}
          onClick={() => void persist({ ...DEFAULT_LABELS })}
        >
          Reset
        </button>
      </div>
      <p className="subtle">
        Rename the built-in customer fields. Your saved information stays the
        same.
      </p>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !busy)
            void persist(
              Object.fromEntries(
                keys.map((k) => [k, draft[k].trim()]),
              ) as Labels,
            );
        }}
      >
        {keys.map((key) => (
          <label className="field" key={key}>
            <span>Default: {DEFAULT_LABELS[key]}</span>
            <input
              aria-label={"Field name for " + DEFAULT_LABELS[key]}
              value={draft[key]}
              maxLength={40}
              required
              disabled={busy}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            />
          </label>
        ))}
        {error && <p role="alert">{error}</p>}
        <button className="primary" disabled={busy || !valid || !dirty}>
          Save field names
        </button>
      </form>
    </section>
  );
}
