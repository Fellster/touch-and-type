import { Check } from "lucide-react";
import { THEMES, ACCENTS, FONTS } from "../../../src/hooks/useSettings";
import type { Notebook } from "../model";
export default function Appearance({
  settings: s,
  busy,
  change,
}: {
  settings: Notebook["settings"];
  busy: boolean;
  change: (settings: Notebook["settings"]) => void;
}) {
  return (
    <>
      <section>
        <h2>Themes</h2>
        <div className="theme-grid">
          {Object.entries(THEMES).map(([key, t]) => (
            <button
              key={key}
              className="theme-option"
              aria-pressed={s.theme === key}
              disabled={busy}
              onClick={() =>
                change({ ...s, theme: key as typeof s.theme, accent: "theme" })
              }
            >
              <div className="swatches">
                {["--background", "--card", "--foreground", "--primary"].map(
                  (v) => (
                    <span
                      key={v}
                      style={{ background: "hsl(" + t.vars[v] + ")" }}
                    />
                  ),
                )}
              </div>
              <span>{t.label}</span>
              {s.theme === key && <Check size={16} />}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2>Fonts</h2>
        <div className="font-options">
          {Object.entries(FONTS).map(([key, f]) => (
            <button
              key={key}
              aria-pressed={s.font === key}
              disabled={busy}
              style={{ fontFamily: f.stack }}
              onClick={() => change({ ...s, font: key as typeof s.font })}
            >
              {f.label}
              {s.font === key && <Check size={16} />}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2>Highlight color</h2>
        <div className="font-options">
          <button
            aria-pressed={s.accent === "theme"}
            disabled={busy}
            onClick={() => change({ ...s, accent: "theme" })}
          >
            Theme{s.accent === "theme" && <Check size={16} />}
          </button>
          {Object.entries(ACCENTS).map(([key, a]) => (
            <button
              key={key}
              aria-pressed={s.accent === key}
              disabled={busy}
              onClick={() => change({ ...s, accent: key as typeof s.accent })}
            >
              <span
                className="accent-swatch"
                style={{ background: "hsl(" + a.vars["--primary"] + ")" }}
              />
              {a.label}
              {s.accent === key && <Check size={16} />}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
