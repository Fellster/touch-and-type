import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, LogOut, NotebookPen, GripVertical, Pencil } from "lucide-react";
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
import VoiceCapture, { type ParsedResult } from "@/components/VoiceCapture";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CustomerLite = { id: string; name: string; typed_notes: string | null };

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
  onUpdateTitle,
  onRemove,
}: {
  t: Todo;
  onToggle: (t: Todo) => void;
  onUpdateDue: (t: Todo, v: string) => void;
  onUpdateTitle: (t: Todo, v: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(t.title);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };
  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v && v !== t.title) onUpdateTitle(t, v);
    else setDraft(t.title);
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
        {editing ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                setDraft(t.title);
                setEditing(false);
              }
            }}
            rows={3}
            className="w-full resize-none bg-transparent border border-input rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Edit task title"
          />
        ) : (
          <p
            className={`whitespace-pre-wrap break-words line-clamp-3 ${t.done ? "line-through text-muted-foreground" : ""}`}
          >
            {t.title}
          </p>
        )}
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
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="icon" onClick={() => onRemove(t.id)} aria-label="Delete task">
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setDraft(t.title);
            setEditing(true);
          }}
          aria-label="Edit task"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
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
  const [pendingDelete, setPendingDelete] = useState<Todo | null>(null);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerLite | null>(null);
  const [savingNote, setSavingNote] = useState(false);

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
    if (!title.trim()) return toast.error("Type what you need to do first.");
    let uid = user?.id;
    if (!uid) {
      const { data } = await supabase.auth.getUser();
      uid = data.user?.id;
    }
    if (!uid) return toast.error("You're signed out — sign in to add a task.");
    const maxPos = todos.reduce((m, t) => Math.max(m, t.position ?? 0), 0);
    const { error } = await supabase.from("todos").insert({
      user_id: uid,
      title: title.trim(),
      due_at: fromLocalInput(due),
      position: maxPos + 1,
    });
    if (error) return toast.error(error.message);
    toast.success("Task added");
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

  const updateTitle = async (t: Todo, v: string) => {
    setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, title: v } : x)));
    const { error } = await supabase.from("todos").update({ title: v }).eq("id", t.id);
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const doDelete = async (id: string) => {
    setTodos((prev) => prev.filter((x) => x.id !== id));
    const { error } = await supabase.from("todos").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const requestRemove = (id: string) => {
    const t = todos.find((x) => x.id === id) ?? null;
    setPendingDelete(t);
    setCustomerQuery("");
    setSelectedCustomer(null);
    if (customers.length === 0) loadCustomers();
  };

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id,name,typed_notes")
      .order("name", { ascending: true });
    if (error) return toast.error(error.message);
    setCustomers((data ?? []) as CustomerLite[]);
  };

  const saveToNotesAndDelete = async () => {
    if (!pendingDelete || !selectedCustomer) return;
    setSavingNote(true);
    const stamp = new Date().toLocaleDateString();
    const next = [selectedCustomer.typed_notes, `[${stamp}] ${pendingDelete.title}`]
      .filter(Boolean)
      .join("\n");
    const { error } = await supabase
      .from("customers")
      .update({ typed_notes: next })
      .eq("id", selectedCustomer.id);
    setSavingNote(false);
    if (error) return toast.error(error.message);
    toast.success(`Saved to ${selectedCustomer.name}'s notes`);
    setCustomers((prev) =>
      prev.map((c) => (c.id === selectedCustomer.id ? { ...c, typed_notes: next } : c)),
    );
    const id = pendingDelete.id;
    setPendingDelete(null);
    await doDelete(id);
  };


  const saveVoiceTodo = async (r: ParsedResult): Promise<void> => {
    if (!user) return;
    const t = r.todo?.title || r.transcript;
    if (!t.trim()) return;
    const maxPos = todos.reduce((m, x) => Math.max(m, x.position ?? 0), 0);
    const { error } = await supabase.from("todos").insert({
      user_id: user.id,
      title: t.trim(),
      due_at: r.todo?.due_at ?? null,
      position: maxPos + 1,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("To-do added");
    load();
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

  const renderSection = (
    label: string,
    items: Todo[],
    groupKey: keyof typeof groups,
    opts: { tone?: string; draggable?: boolean } = {},
  ) => {
    const { tone, draggable = true } = opts;
    if (items.length === 0) return null;
    const list = (
      <div className="space-y-2">
        {items.map((t) => (
          <SortableTodo key={t.id} t={t} onToggle={toggle} onUpdateDue={updateDue} onUpdateTitle={updateTitle} onRemove={requestRemove} />
        ))}
      </div>
    );
    return (
      <div className="space-y-2" key={groupKey}>
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
            <VoiceCapture
              context="todo"
              onCommit={saveVoiceTodo}
              variant="outline"
              className="h-11 w-11"
              title="Add task by voice"
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
            {renderSection("Overdue", groups.overdue, "overdue", { tone: "text-destructive" })}
            {renderSection("Today", groups.today, "today")}
            {renderSection("Upcoming", groups.upcoming, "upcoming")}
            {renderSection("No date / Later", groups.later, "later")}
            {renderSection("Completed", groups.completed, "completed", {
              tone: "text-muted-foreground",
              draggable: false,
            })}
          </>
        )}
      </section>

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete task</DialogTitle>
            <DialogDescription>
              Save this task to a customer's notes before deleting it?
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm whitespace-pre-wrap border rounded px-3 py-2 bg-muted/40">
            {pendingDelete?.title}
          </p>

          <div className="space-y-2">
            <Input
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              placeholder="Search customers…"
              aria-label="Search customers"
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {customers
                .filter((c) => c.name.toLowerCase().includes(customerQuery.trim().toLowerCase()))
                .slice(0, 50)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCustomer(c)}
                    className={`w-full text-left text-sm px-3 py-2 rounded border ${
                      selectedCustomer?.id === c.id ? "border-primary bg-accent" : "border-transparent hover:bg-accent"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              {customers.length === 0 && (
                <p className="text-xs text-muted-foreground px-1">No customers found.</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const id = pendingDelete!.id;
                setPendingDelete(null);
                doDelete(id);
              }}
            >
              Delete without saving
            </Button>
            <Button disabled={!selectedCustomer || savingNote} onClick={saveToNotesAndDelete}>
              {savingNote ? "Saving…" : "Save to notes & delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>

  );
}
