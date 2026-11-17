import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Customer, Todo } from "./model";

export type CalendarDraft = {
  title: string;
  description: string;
  start: number;
  end: number;
};
interface AndroidActions {
  calendar(options: CalendarDraft): Promise<void>;
  email(options: { to: string; subject: string; body: string }): Promise<void>;
}
const actions = registerPlugin<AndroidActions>("NotedActions");
export function calendarDraft(todo: Todo, customer?: Customer): CalendarDraft {
  if (!todo.due || !Number.isFinite(Date.parse(todo.due)))
    throw new Error("Schedule this to-do before adding it to your calendar.");
  const start = Date.parse(todo.due);
  return {
    title: customer
      ? `Noted follow-up with ${customer.name}`
      : "Noted follow-up",
    description: todo.title,
    start,
    end: start + 30 * 60 * 1000,
  };
}
export async function openCalendar(todo: Todo, customer?: Customer) {
  const draft = calendarDraft(todo, customer);
  if (Capacitor.getPlatform() === "android") return actions.calendar(draft);
  throw new Error("Calendar opens in the installed Android app.");
}
export async function openEmail(to: string, subject = "", body = "") {
  if (!to.trim() || /[\r\n]/.test(to))
    throw new Error("Add a valid customer email address first.");
  if (Capacitor.getPlatform() === "android")
    return actions.email({ to, subject, body });
  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
