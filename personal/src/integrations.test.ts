import { describe, it, expect, vi } from "vitest";
import { emptyNotebook } from "./model";
const mocks = vi.hoisted(() => ({
  calendar: vi.fn(async () => {}),
  email: vi.fn(async () => {}),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => "android" },
  registerPlugin: () => mocks,
}));
import { calendarDraft, openCalendar, openEmail } from "./integrations";
const todo = {
  id: "task",
  customerId: "c",
  title: "Call about loafers",
  due: "2026-11-18T15:30:00Z",
  position: 0,
  done: false,
};
const customer = {
  id: "c",
  name: "Maria",
  phone: "",
  email: "maria@example.com",
  designers: [],
  shoeSize: "8",
  width: "",
  wants: [],
  notes: "private details",
  personalNotes: "",
  custom: {},
  updatedAt: new Date().toISOString(),
};
describe("user-reviewed Android drafts", () => {
  it("creates a customer calendar draft with the scheduled time and no notebook content", async () => {
    const draft = calendarDraft(todo, customer);
    expect(draft.title).toBe("Noted follow-up with Maria");
    expect(draft.start).toBe(Date.parse(todo.due));
    expect(draft.end - draft.start).toBe(1800000);
    expect(draft.description).toBe(todo.title);
    expect(JSON.stringify(draft)).not.toContain("private details");
    await openCalendar(todo, customer);
    expect(mocks.calendar).toHaveBeenCalledWith(draft);
  });
  it("rejects an unscheduled event", () =>
    expect(() => calendarDraft({ ...todo, due: "" })).toThrow("Schedule"));
  it("opens Gmail with only the chosen address and empty content", async () => {
    await openEmail(customer.email);
    expect(mocks.email).toHaveBeenCalledWith({
      to: customer.email,
      subject: "",
      body: "",
    });
    await expect(openEmail("bad\naddress")).rejects.toThrow("valid");
  });
});
