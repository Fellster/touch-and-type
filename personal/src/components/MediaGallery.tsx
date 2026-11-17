import { Trash2 } from "lucide-react";
import type { Notebook } from "../model";
export default function MediaGallery({
  items,
  kind,
  open,
  remove,
  busy = false,
}: {
  items: Notebook["media"];
  kind: "photo" | "drawing";
  open: (data: string) => void;
  remove?: (id: string) => void;
  busy?: boolean;
}) {
  return (
    <div className={"media-grid media-grid-" + kind}>
      {items.map((m) => (
        <figure className="media-tile" key={m.id}>
          <button
            className="media-open"
            aria-label={"Open " + kind}
            onClick={() => open(m.data)}
          >
            <img
              src={m.data}
              alt={m.name || "Customer " + kind}
              loading="lazy"
            />
          </button>
          {m.text && <figcaption className="pre">{m.text}</figcaption>}
          {remove && (
            <button
              className="media-delete icon-button"
              aria-label={"Delete " + kind}
              disabled={busy}
              onClick={() => remove(m.id)}
            >
              <Trash2 size={16} />
            </button>
          )}
        </figure>
      ))}
    </div>
  );
}
