import { customerNotes } from "../notes";
import { Phone, Mail } from "lucide-react";
import type { Customer, Notebook } from "../model";
export default function CustomerRead({
  customer: c,
  media,
  fields,
  openImage,
}: {
  customer: Customer;
  media: Notebook["media"];
  fields: Notebook["customFields"];
  openImage: (url: string) => void;
}) {
  const info = [
    ["Shoe size", c.shoeSize],
    ["Width", c.width],
    ["Designers", c.designers.join(" · ")],
    ["Wants", c.wants.join(" · ")],
    ...Object.entries(c.custom).map(([key, value]) => [
      String(
        fields.find((f) => f.key === key)?.label ?? key.replace(/_/g, " "),
      ),
      Array.isArray(value)
        ? value.join(" · ")
        : typeof value === "boolean"
          ? value
            ? "Yes"
            : "No"
          : typeof value === "object" && value
            ? JSON.stringify(value)
            : String(value ?? ""),
    ]),
  ].filter(([, value]) => value);
  return (
    <div className="customer-reading">
      <h1>{c.name}</h1>
      <div className="reading-contacts">
        {c.phone && (
          <a href={"tel:" + c.phone.replace(/[^\d+]/g, "")}>
            <Phone size={16} />
            {c.phone}
          </a>
        )}
        {c.email && (
          <a href={"mailto:" + c.email}>
            <Mail size={16} />
            {c.email}
          </a>
        )}
      </div>
      {!!info.length && (
        <section className="card">
          <dl>
            {info.map(([label, value], i) => (
              <div key={i}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {customerNotes(c) && (
        <section>
          <h2>Notes</h2>
          <div className="card pre">{customerNotes(c)}</div>
        </section>
      )}
      {(["drawing", "photo"] as const).map((kind) => {
        const items = media.filter((m) => m.kind === kind);
        return items.length ? (
          <section
            key={kind}
            aria-label={kind === "drawing" ? "Drawings" : "Photos"}
          >
            <h2>{kind === "drawing" ? "Drawings" : "Photos"}</h2>
            <div className={"gallery " + kind}>
              {items.map((m) => (
                <article className="card" key={m.id}>
                  <button
                    className="picture-button"
                    aria-label={"Open " + kind}
                    onClick={() => openImage(m.data)}
                  >
                    <img src={m.data} alt={m.name || kind} />
                  </button>
                  {m.text && <p className="pre">{m.text}</p>}
                </article>
              ))}
            </div>
          </section>
        ) : null;
      })}
      {!info.length && !c.notes && !c.personalNotes && !media.length && (
        <p className="subtle">No additional information yet.</p>
      )}
    </div>
  );
}
