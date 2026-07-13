import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, LogOut, NotebookPen, GripVertical } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Todo = {
  id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  done: boolean;
  created_at: string;
  position: number;
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const formatDue = (iso: string | null) => {
  if (!iso) return "No date";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

function SortableTodo({
  t,
  onToggle,
  onUpdateDue,
  onRemove,
}: {
  t: Todo;
  onToggle: (t: Todo) => void;
  onUpdateDue: (t: Todo, v: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`p-3 flex items-start gap-2 ${t.done ? "opacity-60" : ""} ${isDragging ? "shadow-lg" : ""}`}
    >
      <button
        type="button"
        className="mt-1 touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox
        checked={t.done}
        onCheckedChange={() => onToggle(t)}
        className="mt-1"
        aria-label={`Mark ${t.title} ${t.done ? "not done" : "done"}`}
      />
      <div className="flex-1 min-w-0">
        <p className={`truncate ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
        <div className="mt-1 flex items-center gap-2">
          <Input
            type="datetime-local"
            value={toLocalInput(t.due_at)}
            onChange={(e) => onUpdateDue(t, e.target.value)}
            className="h-8 text-xs w-[210px]"
            aria-label="Due date and time"
          />
          <span className="text-xs text-muted-foreground truncate">{formatDue(t.due_at)}</span>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={() => onRemove(t.id)} aria-label="Delete task">
        <Trash2 className="h-4 w-4" />
      </Button>
    </Card>
  );
}

export default function Index() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("todos")
      .select("*")
      .order("position", { ascending: true });
    if (error) toast.error(error.message);
    setTodos((data ?? []) as Todo[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const maxPos = todos.reduce((m, t) => Math.max(m, t.position ?? 0), 0);
    const { error } = await supabase.from("todos").insert({
      user_id: user!.id,
      title: title.trim(),
      due_at: fromLocalInput(due),
      position: maxPos + 1,
    });
    if (error) return toast.error(error.message);
    setTitle("");
    setDue("");
    load();
  };

  const toggle = async (t: Todo) => {
    setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    const { error } = await supabase.from("todos").update({ done: !t.done }).eq("id", t.id);
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const updateDue = async (t: Todo, v: string) => {
    const iso = fromLocalInput(v);
    setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, due_at: iso } : x)));
    const { error } = await supabase.from("todos").update({ due_at: iso }).eq("id", t.id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    setTodos((prev) => prev.filter((x) => x.id !== id));
    const { error } = await supabase.from("todos").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const groups = useMemo(() => {
    const now = new Date();
    const startOfTomorrow = new Date(now);
    startOfTomorrow.setHours(24, 0, 0, 0);
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const g = {
      overdue: [] as Todo[],
      today: [] as Todo[],
      upcoming: [] as Todo[],
      later: [] as Todo[],
      completed: [] as Todo[],
    };
    todos.forEach((t) => {
      if (t.done) return g.completed.push(t);
      if (!t.due_at) return g.later.push(t);
      const d = new Date(t.due_at);
      if (d < now) g.overdue.push(t);
      else if (d < startOfTomorrow) g.today.push(t);
      else if (d < endOfWeek) g.upcoming.push(t);
      else g.later.push(t);
    });
    // each group already comes sorted by position from the query
    return g;
  }, [todos]);

  const handleDragEnd = async (groupKey: keyof typeof groups, e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const items = groups[groupKey];
    const oldIndex = items.findIndex((x) => x.id === active.id);
    const newIndex = items.findIndex((x) => x.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(items, oldIndex, newIndex);

    // Recompute positions for this group using evenly spaced values based on
    // the min/max existing positions in the group (falls back to indices).
    const basePositions = items.map((x) => x.position).sort((a, b) => a - b);
    const min = basePositions[0] ?? 0;
    const max = basePositions[basePositions.length - 1] ?? reordered.length;
    const span = max - min || reordered.length;
    const step = span / Math.max(reordered.length, 1);
    const updates = reordered.map((item, i) => ({ id: item.id, position: min + step * i }));

    // Optimistic update
    setTodos((prev) => {
      const map = new Map(updates.map((u) => [u.id, u.position]));
      return prev.map((t) => (map.has(t.id) ? { ...t, position: map.get(t.id)! } : t));
    });

    // Persist
    const results = await Promise.all(
      updates.map((u) => supabase.from("todos").update({ position: u.position }).eq("id", u.id)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast.error(failed.error.message);
      load();
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    nav("/auth");
  };

  const Section = ({
    label,
    items,
    tone,
    groupKey,
    draggable = true,
  }: {
    label: string;
    items: Todo[];
    tone?: string;
    groupKey: keyof typeof groups;
    draggable?: boolean;
  }) => {
    if (items.length === 0) return null;
    const list = (
      <div className="space-y-2">
        {items.map((t) => (
          <SortableTodo key={t.id} t={t} onToggle={toggle} onUpdateDue={updateDue} onRemove={remove} />
        ))}
      </div>
    );
    return (
      <div className="space-y-2">
        <h2 className={`font-serif text-lg ${tone ?? "text-foreground"}`}>{label}</h2>
        {draggable ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => handleDragEnd(groupKey, e)}
          >
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {list}
            </SortableContext>
          </DndContext>
        ) : (
          list
        )}
      </div>
    );
  };

  return (
    <main className="min-h-screen pb-24">
      <SEO
        title="To-Do — Atelier"
        description="A simple, private to-do list scheduled by date and time."
        path="/"
      />
      <header className="px-5 pt-8 pb-4 max-w-2xl mx-auto">
        <div className="flex justify-end gap-1 mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => nav("/customers")}
            aria-label="Customer notebook"
            title="Customer notebook (legacy)"
          >
            <NotebookPen className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
        <h1 className="font-serif text-3xl">To-Do</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {todos.filter((t) => !t.done).length} open · {todos.filter((t) => t.done).length} done
        </p>
      </header>

      <section className="px-5 max-w-2xl mx-auto">
        <form onSubmit={add} className="space-y-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you need to do?"
            className="h-11"
            aria-label="New task"
          />
          <div className="flex gap-2">
            <Input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="flex-1 h-11"
              aria-label="Due date and time"
            />
            <Button type="submit" className="h-11">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </form>
      </section>

      <section className="px-5 max-w-2xl mx-auto mt-4 flex gap-2">
        <Button variant="outline" className="flex-1 h-11" onClick={() => nav("/customers?add=1")}>
          <Plus className="h-4 w-4 mr-1" />
          Add customer
        </Button>
        <Button variant="outline" className="flex-1 h-11" onClick={() => nav("/customers")}>
          <NotebookPen className="h-4 w-4 mr-1" />
          Search customers
        </Button>
      </section>


      <section className="px-5 max-w-2xl mx-auto mt-6 space-y-6">
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Loading…</p>
        ) : todos.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Nothing yet. Add your first task above.</p>
        ) : (
          <>
            <Section label="Overdue" items={groups.overdue} tone="text-destructive" groupKey="overdue" />
            <Section label="Today" items={groups.today} groupKey="today" />
            <Section label="Upcoming" items={groups.upcoming} groupKey="upcoming" />
            <Section label="No date / Later" items={groups.later} groupKey="later" />
            <Section
              label="Completed"
              items={groups.completed}
              tone="text-muted-foreground"
              groupKey="completed"
              draggable={false}
            />
          </>
        )}
      </section>
    </main>
  );
}
