import { describe, expect, it } from "vitest";
import { applyTodoPositions } from "./todoOrder";

describe("optimistic to-do order", () => {
  it("immediately displays a moved task at its new position without mutating the original list", () => {
    const original = [{ id: "a", position: 1 }, { id: "b", position: 2 }, { id: "c", position: 3 }];
    const result = applyTodoPositions(original, [{ id: "c", position: 1 }, { id: "a", position: 2 }, { id: "b", position: 3 }]);
    expect(result.map((todo) => todo.id)).toEqual(["c", "a", "b"]);
    expect(original).toEqual([{ id: "a", position: 1 }, { id: "b", position: 2 }, { id: "c", position: 3 }]);
  });

  it("keeps tasks outside the reordered group and retains task details", () => {
    const result = applyTodoPositions([
      { id: "a", position: 10, title: "First", done: false },
      { id: "other", position: 15, title: "Completed", done: true },
      { id: "b", position: 20, title: "Second", done: false },
    ], [{ id: "b", position: 10 }, { id: "a", position: 20 }]);
    expect(result.filter((todo) => !todo.done).map((todo) => todo.id)).toEqual(["b", "a"]);
    expect(result.find((todo) => todo.id === "other")).toEqual({ id: "other", position: 15, title: "Completed", done: true });
    expect(result.find((todo) => todo.id === "b")?.title).toBe("Second");
  });
});
