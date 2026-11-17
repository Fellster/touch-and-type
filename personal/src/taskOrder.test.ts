import { describe, it, expect } from "vitest";
import { orderedTasks } from "./taskOrder";
import { taskGroups } from "./components/TaskBoard";
import type { Todo } from "./model";
const t = (id: string, due = "", done = false, position = 0): Todo => ({
  id,
  customerId: null,
  title: id,
  due,
  done,
  position,
});
describe("original notebook task behavior", () => {
  it("assigns due dates to the same five visible sections", () => {
    const now = new Date("2026-11-17T12:00:00");
    const groups = taskGroups(
      [
        t("overdue", "2026-11-17T10:00:00"),
        t("today", "2026-11-17T16:00:00"),
        t("upcoming", "2026-11-18T10:00:00"),
        t("later"),
        t("far", "2027-01-01T10:00:00"),
        t("done", "", true),
      ],
      now,
    );
    expect(groups.Overdue.map((t) => t.id)).toEqual(["overdue"]);
    expect(groups.Today.map((t) => t.id)).toEqual(["today"]);
    expect(groups.Upcoming.map((t) => t.id)).toEqual(["upcoming"]);
    expect(groups["No date / Later"].map((t) => t.id)).toEqual([
      "later",
      "far",
    ]);
    expect(groups.Completed.map((t) => t.id)).toEqual(["done"]);
  });
  it("keeps a dragged order even when imported records have identical positions", () => {
    const result = orderedTasks([t("a"), t("other"), t("b")], ["b", "a"]);
    expect(
      [...result].sort((a, b) => a.position - b.position).map((t) => t.id),
    ).toEqual(["b", "other", "a"]);
    expect(new Set(result.map((t) => t.position)).size).toBe(3);
  });
  it("rejects invalid drop IDs rather than corrupting saved positions", () => {
    expect(() => orderedTasks([t("a")], ["missing"])).toThrow();
    expect(() => orderedTasks([t("a")], ["a", "a"])).toThrow();
  });
});
