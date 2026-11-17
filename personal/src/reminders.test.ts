import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  checkPermissions: vi.fn(async () => ({ display: "granted" })),
  checkExactNotificationSetting: vi.fn(async () => ({
    exact_alarm: "granted",
  })),
  requestPermissions: vi.fn(async () => ({ display: "granted" })),
  getAll: vi.fn(async () => ({ notifications: [] as any[] })),
  cancel: vi.fn(async () => {}),
  removeDeliveredNotificationsById: vi.fn(async () => {}),
  schedule: vi.fn(async (_options: { notifications: any[] }) => ({})),
  createChannel: vi.fn(async () => {}),
  registerActionTypes: vi.fn(async () => {}),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => "android" },
}));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: mock }));
import { emptyNotebook, type Notebook } from "./model";
import {
  BACKUP_ID,
  enableNotificationPermission,
  notificationIds,
  readReminderPreferences,
  reminderPlan,
  rememberVerifiedBackup,
  syncReminders,
  writeReminderPreferences,
  type ReminderPreferences,
} from "./reminders";
const now = Date.parse("2026-11-18T12:00:00Z");
const due = new Date(now + 3600000).toISOString();
function fixture(): Notebook {
  const n = emptyNotebook();
  n.customers.push({
    id: "c",
    name: "Maria",
    phone: "",
    email: "",
    designers: [],
    shoeSize: "",
    width: "",
    wants: [],
    notes: "Private notes",
    personalNotes: "",
    custom: {},
    updatedAt: new Date(now).toISOString(),
  });
  n.todos.push({
    id: "t",
    customerId: "c",
    title: "Call about loafers",
    due,
    done: false,
    position: 0,
  });
  return n;
}
const prefs = (): ReminderPreferences => ({
  todos: true,
  backup: false,
  lastBackup: 0,
  backupAnchor: now,
  snoozes: {},
});
let values: Map<string, string>;
beforeEach(() => {
  vi.clearAllMocks();
  mock.getAll.mockResolvedValue({ notifications: [] });
  mock.checkPermissions.mockResolvedValue({ display: "granted" });
  mock.checkExactNotificationSetting.mockResolvedValue({
    exact_alarm: "granted",
  });
  mock.requestPermissions.mockResolvedValue({ display: "granted" });
  values = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
  });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
});
describe("offline reminders", () => {
  it("schedules linked tasks at their due time without private notebook content", () => {
    const plan = reminderPlan(fixture(), prefs(), now, true);
    expect(plan).toHaveLength(1);
    expect(plan[0].title).toBe("Noted follow-up with Maria");
    expect(plan[0].schedule?.at?.getTime()).toBe(Date.parse(due));
    expect(JSON.stringify(plan)).not.toContain("Private notes");
  });
  it("excludes undated, completed and past tasks, with no alert flood on enable", () => {
    const n = fixture();
    expect(reminderPlan(n, prefs(), now + 7200000, false)).toEqual([]);
    n.todos[0].done = true;
    expect(reminderPlan(n, prefs(), now, true)).toEqual([]);
    n.todos[0].done = false;
    n.todos[0].due = "";
    expect(reminderPlan(n, prefs(), now, true)).toEqual([]);
  });
  it("snoozes without changing the due time; rescheduling invalidates an old snooze", () => {
    const n = fixture(),
      p = prefs();
    p.snoozes.t = { due, at: now + 7200000 };
    expect(reminderPlan(n, p, now, true)[0].schedule?.at?.getTime()).toBe(
      now + 7200000,
    );
    expect(n.todos[0].due).toBe(due);
    n.todos[0].due = new Date(now + 10800000).toISOString();
    expect(reminderPlan(n, p, now, true)[0].schedule?.at?.getTime()).toBe(
      now + 10800000,
    );
  });
  it("assigns stable positive Android ids independent of order and resolves collisions", () => {
    const ids = Array.from({ length: 12000 }, (_, i) => "task-" + i);
    const forward = notificationIds(ids),
      reverse = notificationIds([...ids].reverse());
    expect(forward).toEqual(reverse);
    expect(new Set(forward.values()).size).toBe(ids.length);
    expect([...forward.values()].every((id) => id > 0 && id < 2147483646)).toBe(
      true,
    );
  });
  it("keeps an existing matching schedule, including after app restart", async () => {
    const n = fixture();
    n.todos[0].due = new Date(Date.now() + 600000).toISOString();
    writeReminderPreferences(prefs());
    const planned = reminderPlan(n, prefs(), Date.now(), true);
    mock.getAll.mockResolvedValue({ notifications: planned });
    await syncReminders(n);
    expect(mock.schedule).not.toHaveBeenCalled();
    expect(mock.cancel).not.toHaveBeenCalled();
  });
  it("cancels old schedules and delivered alerts when task is completed or removed", async () => {
    const n = fixture();
    n.todos[0].due = new Date(Date.now() + 600000).toISOString();
    writeReminderPreferences(prefs());
    const old = reminderPlan(n, prefs(), Date.now(), true);
    mock.getAll.mockResolvedValue({ notifications: old });
    n.todos[0].done = true;
    await syncReminders(n);
    expect(mock.cancel).toHaveBeenCalledWith({
      notifications: [{ id: old[0].id }],
    });
    expect(mock.removeDeliveredNotificationsById).toHaveBeenCalledWith({
      ids: [old[0].id],
    });
    expect(mock.schedule).not.toHaveBeenCalled();
  });
  it("replaces a rescheduled task with just one new alert", async () => {
    const n = fixture();
    n.todos[0].due = new Date(Date.now() + 600000).toISOString();
    writeReminderPreferences(prefs());
    mock.getAll.mockResolvedValue({
      notifications: reminderPlan(n, prefs(), Date.now(), true),
    });
    n.todos[0].due = new Date(Date.now() + 1200000).toISOString();
    await syncReminders(n);
    expect(mock.cancel).toHaveBeenCalledTimes(1);
    expect(mock.schedule.mock.calls[0][0].notifications).toHaveLength(1);
  });
  it("does not prompt or schedule when OS permission is denied and cancels old alerts", async () => {
    writeReminderPreferences(prefs());
    mock.checkPermissions.mockResolvedValue({ display: "denied" });
    mock.getAll.mockResolvedValue({
      notifications: reminderPlan(fixture(), prefs(), now, true),
    });
    await syncReminders(fixture());
    expect(mock.schedule).not.toHaveBeenCalled();
    expect(mock.requestPermissions).not.toHaveBeenCalled();
    expect(mock.cancel).toHaveBeenCalledTimes(1);
  });
  it("keeps valid delivered reminders without re-alerting overdue tasks", async () => {
    const n = fixture();
    n.todos[0].due = new Date(Date.now() - 60000).toISOString();
    writeReminderPreferences(prefs());
    mock.getAll.mockResolvedValue({
      notifications: reminderPlan(n, prefs(), Date.now() - 120000, true),
    });
    await syncReminders(n);
    expect(mock.cancel).not.toHaveBeenCalled();
    expect(mock.schedule).not.toHaveBeenCalled();
  });
  it("uses inexact reminders without opening special settings if precise timing is denied", async () => {
    const n = fixture();
    n.todos[0].due = new Date(Date.now() + 600000).toISOString();
    writeReminderPreferences(prefs());
    mock.checkExactNotificationSetting.mockResolvedValue({
      exact_alarm: "denied",
    });
    await syncReminders(n);
    expect(
      mock.schedule.mock.calls[0][0].notifications[0].isExactNotification,
    ).toBe(false);
  });
  it("uses one weekly backup schedule; a verified backup resets it", async () => {
    const p = prefs();
    p.backup = true;
    writeReminderPreferences(p);
    const weekly = reminderPlan(emptyNotebook(), p, now, true);
    expect(weekly).toHaveLength(1);
    expect(weekly[0].id).toBe(BACKUP_ID);
    expect(weekly[0].schedule).toEqual({ every: "week" });
    const before = Date.now();
    await rememberVerifiedBackup();
    expect(readReminderPreferences().lastBackup).toBeGreaterThanOrEqual(before);
    expect(mock.cancel).toHaveBeenCalledWith({
      notifications: [{ id: BACKUP_ID }],
    });
  });
  it("explains denied permission when user tries to enable", async () => {
    mock.requestPermissions.mockResolvedValue({ display: "denied" });
    await expect(enableNotificationPermission()).rejects.toThrow(
      "Android Settings",
    );
  });
});
