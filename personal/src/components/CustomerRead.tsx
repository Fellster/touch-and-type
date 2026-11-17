import { customerNotes } from "../notes";
import MediaGallery from "./MediaGallery";
import { Phone, Mail, Camera, Upload } from "lucide-react";
import type { Customer, Notebook } from "../model";
export default function CustomerRead({
  customer: c,
  media,
  fields,
  labels,
  photo,
  camera,
  email,
  busy,
  openImage,
}: {
  customer: Customer;
  photo: () => void;
  camera: () => void;
  email: () => void;
  busy: boolean;
  labels: Notebook["settings"]["labels"];
  media: Notebook["media"];
  fields: Notebook["customFields"];
  openImage: (url: string) => void;
}) {
  const info = [
    [labels.shoe_size, c.shoeSize],
    [labels.width, c.width],
    [labels.designers, c.designers.join(" · ")],
    [labels.looking_for, c.wants.join(" · ")],
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
          <button className="contact-email" onClick={email}>
            <Mail size={16} />
            {c.email}
          </button>
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
        return items.length || kind === "photo" ? (
          <section
            key={kind}
            aria-label={kind === "drawing" ? "Drawings" : "Photos"}
          >
            <div className="section-heading">
              <h2>{kind === "drawing" ? "Drawings" : "Photos"}</h2>
              {kind === "photo" && (
                <div className="photo-actions">
                  <button
                    aria-label="Take photo"
                    onClick={camera}
                    disabled={busy}
                  >
                    <Camera size={16} />
                    Take photo
                  </button>
                  <button
                    aria-label="Add photo"
                    onClick={photo}
                    disabled={busy}
                  >
                    <Upload size={16} />
                    Upload
                  </button>
                </div>
              )}
            </div>
            <MediaGallery items={items} kind={kind} open={openImage} />
            {kind === "photo" && !items.length && (
              <p className="subtle">No photos yet.</p>
            )}
          </section>
        ) : null;
      })}
      {!info.length && !c.notes && !c.personalNotes && !media.length && (
        <p className="subtle">No additional information yet.</p>
      )}
    </div>
  );
}
