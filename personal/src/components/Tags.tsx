import { useId, useState } from "react";
import { Plus, X } from "lucide-react";
export default function Tags({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [text, setText] = useState("");
  const id = useId();
  const add = () => {
    if (text.trim()) {
      onChange([...values, text.trim()]);
      setText("");
    }
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="tags">
        {values.map((v, i) => (
          <span key={i}>
            {v}
            <button
              type="button"
              aria-label={"Remove " + v}
              onClick={() => onChange(values.filter((_, j) => i !== j))}
            >
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
      <div className="tag-entry">
        <input
          id={id}
          value={text}
          placeholder={"Add " + label.toLowerCase() + "…"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          aria-label={"Add " + label.toLowerCase()}
          onClick={add}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
