import { useState, useRef } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import type { Customer, Todo } from "../model";
export function taskGroups(todos: Todo[], now: Date) {
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  const nextWeek = new Date(tomorrow);
  nextWeek.setDate(nextWeek.getDate() + 6);
  const groups: Record<string, Todo[]> = {
    Overdue: [],
    Today: [],
    Upcoming: [],
    "No date / Later": [],
    Completed: [],
  };
  [...todos]
    .sort((a, b) => a.position - b.position)
    .forEach((t) => {
      const due = t.due ? new Date(t.due) : null;
      const group = t.done
        ? "Completed"
        : !due
          ? "No date / Later"
          : due < now
            ? "Overdue"
            : due < tomorrow
              ? "Today"
              : due < nextWeek
                ? "Upcoming"
                : "No date / Later";
      groups[group].push(t);
    });
  return groups;
}
export function localDue(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
type Props = {
  todos: Todo[];
  customers: Customer[];
  busy: boolean;
  toggle: (t: Todo) => void;
  saveTitle: (t: Todo, title: string) => Promise<void>;
  remove: (t: Todo) => void;
  due: (t: Todo, date: string) => void;
  openCustomer: (id: string) => void;
  reorder: (ids: string[]) => void;
};
export default function TaskBoard(p: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const groups = taskGroups(p.todos, new Date());
  return (
    <div className="task-groups">
      {Object.entries(groups)
        .filter(([, items]) => items.length)
        .map(([name, items]) => (
          <section
            key={name}
            aria-label={name}
            className={name === "Completed" ? "completed-group" : ""}
          >
            <h2 className={name === "Overdue" ? "overdue" : ""}>{name}</h2>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={({ active, over }) => {
                if (p.busy || !over || active.id === over.id) return;
                const old = items.findIndex((t) => t.id === active.id),
                  next = items.findIndex((t) => t.id === over.id);
                if (old >= 0 && next >= 0)
                  p.reorder(arrayMove(items, old, next).map((t) => t.id));
              }}
            >
              <SortableContext
                items={items.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {items.map((t) => (
                  <Task key={t.id} {...p} t={t} />
                ))}
              </SortableContext>
            </DndContext>
          </section>
        ))}
    </div>
  );
}
function Task(p: Props & { t: Todo }) {
  const { t } = p;
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(t.title),
    [editError, setEditError] = useState("");
  const saving = useRef(false),
    canceled = useRef(false);
  const save = async () => {
    if (saving.current || canceled.current) return;
    if (!draft.trim()) {
      setEditError("Enter a task title.");
      return;
    }
    if (draft.trim() === t.title) {
      setEditing(false);
      return;
    }
    saving.current = true;
    try {
      await p.saveTitle(t, draft.trim());
      setEditing(false);
      setEditError("");
    } catch {
      setEditError("Could not save. Your edit is still here.");
    } finally {
      saving.current = false;
    }
  };
  const drag = useSortable({ id: t.id, disabled: p.busy || t.done });
  const customer =
    p.customers.find((c) => c.id === t.customerId) ??
    p.customers.find((c) =>
      t.title
        .split("\n")
        .some(
          (line) => line.trim().toLowerCase() === c.name.trim().toLowerCase(),
        ),
    );
  const visibleTitle = customer
    ? t.title
        .split("\n")
        .filter(
          (line) =>
            line.trim().toLowerCase() !== customer.name.trim().toLowerCase(),
        )
        .join("\n") || t.title
    : t.title;
  return (
    <article
      className={
        "card task " +
        (t.done ? "done" : "") +
        (drag.isDragging ? " dragging" : "")
      }
      ref={drag.setNodeRef}
      style={{
        transform: CSS.Transform.toString(drag.transform),
        transition: drag.transition,
      }}
    >
      <button
        className="icon-button drag-handle"
        aria-label={"Drag to reorder " + t.title}
        disabled={p.busy || t.done}
        {...drag.attributes}
        {...drag.listeners}
      >
        <GripVertical size={16} />
      </button>
      <input
        type="checkbox"
        aria-label={"Complete " + t.title}
        checked={t.done}
        disabled={p.busy}
        onChange={() => p.toggle(t)}
      />
      <div className="task-text">
        {editing ? (
          <>
            <textarea
              rows={3}
              autoFocus
              aria-label="Edit task title"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void save()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void save();
                } else if (e.key === "Escape") {
                  canceled.current = true;
                  setEditing(false);
                  setDraft(t.title);
                }
              }}
            />
            {editError && <p role="alert">{editError}</p>}
          </>
        ) : (
          <p className="pre task-title">{visibleTitle}</p>
        )}
        {customer && (
          <button
            className="customer-link"
            onClick={() => p.openCustomer(customer.id)}
          >
            {customer.name}
          </button>
        )}
        <div className="task-date">
          <input
            type="datetime-local"
            aria-label={"Due date for " + t.title}
            disabled={p.busy}
            value={t.due ? localDue(t.due) : ""}
            onChange={(e) =>
              p.due(
                t,
                e.target.value ? new Date(e.target.value).toISOString() : "",
              )
            }
          />
        </div>
      </div>
      <div className="task-actions">
        <button
          className="icon-button"
          aria-label={"Delete " + t.title}
          disabled={p.busy}
          onClick={() => p.remove(t)}
        >
          <Trash2 size={16} />
        </button>
        <button
          className="icon-button"
          aria-label={"Edit " + t.title}
          disabled={p.busy}
          onClick={() => {
            setDraft(t.title);
            setEditError("");
            canceled.current = false;
            setEditing(true);
          }}
        >
          <Pencil size={16} />
        </button>
      </div>
    </article>
  );
}
