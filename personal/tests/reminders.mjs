// Exercise the real app against a simulated native bridge. OS delivery is tested on Pixel.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
await page.addInitScript(() => {
  window.CapacitorCustomPlatform = { name: "android" };
  const read = (key, fallback) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const methods = {
    NotedNotebook: ["load", "save"],
    LocalNotifications: ["checkPermissions", "requestPermissions", "checkExactNotificationSetting", "changeExactNotificationSetting", "createChannel", "registerActionTypes", "getAll", "cancel", "removeDeliveredNotificationsById", "schedule", "removeListener"],
  };
  window.Capacitor = {
    PluginHeaders: Object.entries(methods).map(([name, methods]) => ({ name, methods: [...methods.map(name => ({ name, rtype: "promise" })), { name: "addListener", rtype: "callback" }] })),
    nativeCallback(plugin, method, options, callback) {
      window.reminderAction = callback;
      const pending = read("mock-cold-action", null);
      if (pending) { localStorage.removeItem("mock-cold-action"); setTimeout(() => callback(pending), 0); }
      return "listener";
    },
    async nativePromise(plugin, method, options) {
      if (plugin === "NotedNotebook") {
        if (method === "load") return read("mock-notebook", { revision: 0, payload: null });
        const old = read("mock-notebook", { revision: 0 });
        if (old.revision !== options.revision) throw new Error("Conflict");
        const snapshot = { revision: old.revision + 1, payload: options.payload };
        write("mock-notebook", snapshot); return { revision: snapshot.revision };
      }
      if (method === "checkPermissions") return { display: read("mock-permission", "prompt") };
      if (method === "requestPermissions") { write("mock-permission", "granted"); return { display: "granted" }; }
      if (method === "checkExactNotificationSetting") return { exact_alarm: "denied" };
      if (method === "getAll") return { notifications: read("mock-notifications", []) };
      if (method === "cancel") write("mock-notifications", read("mock-notifications", []).filter(n => !options.notifications.some(d => d.id === n.id)));
      if (method === "schedule") {
        const existing = read("mock-notifications", []).filter(n => !options.notifications.some(d => d.id === n.id));
        write("mock-notifications", [...existing, ...options.notifications]);
        return { notifications: options.notifications.map(n => ({ id: n.id })) };
      }
      return {};
    },
  };
});
await page.goto("http://127.0.0.1:5182/");
await expect(page.getByRole("heading", { name: "To-Do", exact: true })).toBeVisible();
await page.getByLabel("New task", { exact: true }).fill("Call Maria");
const future = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
await page.getByLabel("Due date and time", { exact: true }).fill(future);
await page.getByRole("button", { name: "Add", exact: true }).click();
await page.getByRole("button", { name: "Settings", exact: true }).click();
await page.getByLabel("To-do reminders", { exact: true }).check();
await expect(page.getByRole("button", { name: "Allow precise timing", exact: true })).toBeVisible();
const readNotifications = () => page.evaluate(() => JSON.parse(localStorage.getItem("mock-notifications") || "[]"));
await expect.poll(async () => (await readNotifications()).length).toBe(1);
const original = (await readNotifications())[0];
assert.equal(original.isExactNotification, false);
await page.evaluate(n => window.reminderAction({ actionId: "snooze15", notification: n }), original);
await expect(page.locator(".noted-toast[role=status]")).toContainText("snoozed for 15 minutes");
const snoozed = (await readNotifications())[0];
assert.equal(snoozed.extra.due, original.extra.due);
assert.ok(Date.parse(snoozed.schedule.at) < Date.parse(original.schedule.at));
// Cold launch action is retained until the real App registers its listener after notebook load.
await page.evaluate(n => localStorage.setItem("mock-cold-action", JSON.stringify({ actionId: "complete", notification: n })), snoozed);
await page.reload();
await expect(page.locator(".noted-toast[role=status]")).toContainText("To-do completed.");
await expect.poll(async () => (await readNotifications()).length).toBe(0);
const done = await page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem("mock-notebook")).payload).todos[0].done);
assert.equal(done, true);
// An old alert may never complete an already changed/current task a second time.
const revision = await page.evaluate(() => JSON.parse(localStorage.getItem("mock-notebook")).revision);
await page.evaluate(n => window.reminderAction({ actionId: "complete", notification: n }), original);
await expect(page.locator(".noted-toast[role=status]")).toContainText("no longer current");
assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("mock-notebook")).revision), revision);
await page.getByRole("button", { name: "Settings", exact: true }).click();
await page.getByLabel("Weekly backup reminder", { exact: true }).check();
await expect.poll(async () => (await readNotifications()).filter(n => n.extra.kind === "noted-backup").length).toBe(1);
await page.getByLabel("Weekly backup reminder", { exact: true }).uncheck();
await expect.poll(async () => (await readNotifications()).length).toBe(0);
await page.getByRole("button", { name: "Test notification", exact: true }).click();
await expect(page.locator(".noted-toast[role=status]")).toContainText("10 seconds");
const toast = page.locator(".noted-toast");
assert.equal(await toast.evaluate(el => getComputedStyle(el).position), "fixed");
const headerBefore = await page.getByRole("heading", { name: "Settings", exact: true }).boundingBox();
const toastBox = await toast.boundingBox();
assert.ok(toastBox.y + toastBox.height <= 852 - 12);
await page.screenshot({ path: "/tmp/noted-bottom-message.png" });
await page.mouse.move(0, 0);
await expect(toast).toHaveCount(0, { timeout: 8500 });
assert.deepEqual(await page.getByRole("heading", { name: "Settings", exact: true }).boundingBox(), headerBefore);
assert.deepEqual(errors, []);
await browser.close();
console.log("PASS: opt-in permissions, precise-timing fallback, snooze, cold-launch completion, stale actions, weekly toggle and test reminder through real app UI with simulated native bridge.");
