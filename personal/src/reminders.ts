import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  type ActionPerformed,
  type LocalNotificationSchema,
} from "@capacitor/local-notifications";
import type { Notebook } from "./model";

// These choices belong to this phone, not to an imported notebook.
export type ReminderPreferences = {
  todos: boolean;
  backup: boolean;
  backupAnchor: number;
  lastBackup: number;
  snoozes: Record<string, { due: string; at: number }>;
};
const KEY = "noted-personal-reminders-v1";
export const BACKUP_ID = 2147483647;
export const TEST_ID = 2147483646;
export const WEEK = 7 * 24 * 60 * 60 * 1000;
export const isAndroid = () => Capacitor.getPlatform() === "android";
export function readReminderPreferences(): ReminderPreferences {
  const defaults: ReminderPreferences = {
    todos: false,
    backup: false,
    backupAnchor: 0,
    lastBackup: 0,
    snoozes: {},
  };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!saved || typeof saved !== "object") return defaults;
    const snoozes: ReminderPreferences["snoozes"] = {};
    for (const [id, s] of Object.entries(saved.snoozes || {})) {
      const v = s as { due?: unknown; at?: unknown };
      if (
        v &&
        typeof v.due === "string" &&
        typeof v.at === "number" &&
        Number.isFinite(v.at)
      )
        snoozes[id] = { due: v.due, at: v.at };
    }
    return {
      todos: saved.todos === true,
      backup: saved.backup === true,
      backupAnchor: Number.isFinite(saved.backupAnchor)
        ? saved.backupAnchor
        : 0,
      lastBackup: Number.isFinite(saved.lastBackup) ? saved.lastBackup : 0,
      snoozes,
    };
  } catch {
    return defaults;
  }
}
export function writeReminderPreferences(p: ReminderPreferences) {
  localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new Event("noted-reminders-changed"));
}
export function notificationIds(ids: string[]) {
  const used = new Set([BACKUP_ID, TEST_ID]);
  const result = new Map<string, number>();
  for (const id of [...ids].sort()) {
    let hash = 2166136261;
    for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    let number = ((hash >>> 0) % 2147483645) + 1;
    while (used.has(number)) number = (number % 2147483645) + 1;
    used.add(number);
    result.set(id, number);
  }
  return result;
}
export function reminderPlan(
  n: Notebook,
  p: ReminderPreferences,
  now: number,
  exact: boolean,
): LocalNotificationSchema[] {
  const ids = notificationIds(n.todos.map((t) => t.id));
  const plan: LocalNotificationSchema[] = [];
  if (p.todos)
    for (const task of n.todos) {
      const snooze = p.snoozes[task.id];
      const at = snooze?.due === task.due ? snooze.at : Date.parse(task.due);
      if (task.done || !task.due || !Number.isFinite(at) || at <= now) continue;
      const customer = n.customers.find((c) => c.id === task.customerId);
      const title = customer
        ? "Noted follow-up with " + customer.name
        : "Noted to-do";
      const fingerprint = JSON.stringify([
        task.id,
        task.due,
        at,
        task.title,
        title,
        exact,
      ]);
      plan.push({
        id: ids.get(task.id)!,
        title,
        body: task.title,
        channelId: "noted-todos-v1",
        smallIcon: "ic_stat_noted",
        actionTypeId: "noted-task",
        autoCancel: true,
        isExactNotification: exact,
        schedule: { at: new Date(at), allowWhileIdle: true },
        extra: {
          kind: "noted-task",
          taskId: task.id,
          due: task.due,
          fingerprint,
        },
      });
    }
  if (p.backup)
    plan.push({
      id: BACKUP_ID,
      title: "Back up your Noted notebook",
      body: "Keep a copy of your customers, to-dos, photos, and drawings.",
      channelId: "noted-backup-v1",
      smallIcon: "ic_stat_noted",
      autoCancel: true,
      isExactNotification: false,
      schedule: { every: "week" },
      extra: { kind: "noted-backup", fingerprint: String(p.backupAnchor) },
    });
  return plan;
}
let configured: Promise<void> | undefined;
async function configure() {
  return (configured ??= (async () => {
    await LocalNotifications.createChannel({
      id: "noted-todos-v1",
      name: "To-do reminders",
      importance: 4,
      visibility: -1,
      vibration: true,
    });
    await LocalNotifications.createChannel({
      id: "noted-backup-v1",
      name: "Backup reminders",
      importance: 3,
      visibility: -1,
    });
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: "noted-task",
          actions: [
            { id: "complete", title: "Complete", foreground: true },
            { id: "snooze15", title: "15 min", foreground: true },
            { id: "snooze60", title: "1 hour", foreground: true },
          ],
        },
      ],
    });
  })().catch((e) => {
    configured = undefined;
    throw e;
  }));
}
export async function notificationStatus() {
  if (!isAndroid()) return { granted: false, exact: false };
  return {
    granted:
      (await LocalNotifications.checkPermissions()).display === "granted",
    exact:
      (await LocalNotifications.checkExactNotificationSetting()).exact_alarm ===
      "granted",
  };
}
export async function enableNotificationPermission() {
  if (!isAndroid())
    throw new Error("Notifications are available in the Android app.");
  if ((await LocalNotifications.requestPermissions()).display !== "granted")
    throw new Error(
      "Notifications are off. Enable them in Android Settings → Apps → Noted Personal Test → Notifications, then try again.",
    );
}
export async function allowPreciseReminders() {
  await LocalNotifications.changeExactNotificationSetting();
}
let queue = Promise.resolve();
export function syncReminders(n: Notebook) {
  if (!isAndroid()) return Promise.resolve();
  // Serial reconciliation ensures an older save cannot overwrite a newer schedule.
  const work = queue
    .catch(() => {})
    .then(async () => {
      const p = readReminderPreferences();
      const status = await notificationStatus();
      const desired = status.granted
        ? reminderPlan(n, p, Date.now(), status.exact)
        : [];
      const pending = (await LocalNotifications.getAll({})).notifications;
      const owned = pending.filter(
        (v) =>
          v.extra?.kind === "noted-task" || v.extra?.kind === "noted-backup",
      );
      const stale = owned.filter((v) => {
        if (
          desired.some(
            (d) => d.id === v.id && d.extra.fingerprint === v.extra.fingerprint,
          )
        )
          return false;
        // A delivered reminder remains available in the shade until acted on.
        // Merely opening the app must not re-alert or erase a still-valid reminder.
        if (
          status.granted &&
          p.todos &&
          v.extra.kind === "noted-task" &&
          !desired.some((d) => d.id === v.id)
        ) {
          const task = n.todos.find((t) => t.id === v.extra.taskId);
          if (
            task &&
            !task.done &&
            task.due === v.extra.due &&
            task.title === v.body
          )
            return false;
        }
        return true;
      });
      if (stale.length) {
        await LocalNotifications.cancel({
          notifications: stale.map((v) => ({ id: v.id })),
        });
        await LocalNotifications.removeDeliveredNotificationsById({
          ids: stale.map((v) => v.id),
        });
      }
      const changed = desired.filter(
        (d) =>
          !owned.some(
            (v) => v.id === d.id && v.extra.fingerprint === d.extra.fingerprint,
          ),
      );
      if (changed.length) {
        await configure();
        // Never open permission screens during background reconciliation.
        await LocalNotifications.schedule({ notifications: changed });
      }
    });
  queue = work;
  return work;
}
export async function rememberVerifiedBackup() {
  if (!isAndroid()) return;
  const p = readReminderPreferences();
  p.lastBackup = p.backupAnchor = Date.now();
  writeReminderPreferences(p);
  await LocalNotifications.cancel({ notifications: [{ id: BACKUP_ID }] });
  await LocalNotifications.removeDeliveredNotificationsById({
    ids: [BACKUP_ID],
  });
}
export async function testNotification() {
  await enableNotificationPermission();
  await configure();
  const status = await notificationStatus();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: TEST_ID,
        title: "Noted reminders are ready",
        body: "Your scheduled to-dos can remind you here, even offline.",
        smallIcon: "ic_stat_noted",
        channelId: "noted-todos-v1",
        isExactNotification: status.exact,
        schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true },
        extra: { kind: "noted-test" },
      },
    ],
  });
}
export const listenForReminderActions = (
  fn: (action: ActionPerformed) => void,
) => LocalNotifications.addListener("localNotificationActionPerformed", fn);
