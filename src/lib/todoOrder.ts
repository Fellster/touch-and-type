export function applyTodoPositions<T extends { id: string; position: number }>(
  todos: T[],
  updates: { id: string; position: number }[],
): T[] {
  const positions = new Map(updates.map(({ id, position }) => [id, position]));
  return todos
    .map((todo) => positions.has(todo.id) ? { ...todo, position: positions.get(todo.id)! } : todo)
    .sort((a, b) => a.position - b.position);
}
