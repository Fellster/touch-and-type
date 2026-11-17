import type { Todo } from "./model";
/** Normalize positions before applying a group order, including imported duplicate positions. */
export function orderedTasks(todos: Todo[], ids: string[]): Todo[] {
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !todos.some((t) => t.id === id))
  )
    throw new Error("Invalid task order.");
  const normalized = [...todos].sort((a, b) => a.position - b.position);
  const slots = normalized
    .map((t, i) => (ids.includes(t.id) ? i : -1))
    .filter((i) => i >= 0);
  const positions = new Map(normalized.map((t, i) => [t.id, i]));
  ids.forEach((id, i) => positions.set(id, slots[i]));
  return todos.map((t) => ({ ...t, position: positions.get(t.id)! }));
}
