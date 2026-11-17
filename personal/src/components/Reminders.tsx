import { useEffect, useState } from "react";
import {
  allowPreciseReminders,
  enableNotificationPermission,
  isAndroid,
  notificationStatus,
  readReminderPreferences,
  testNotification,
  writeReminderPreferences,
} from "../reminders";

export default function Reminders({
  changed,
  report,
}: {
  changed: () => Promise<void>;
  report: (s: string) => void;
}) {
  const [p, setP] = useState(readReminderPreferences);
  const [status, setStatus] = useState({ granted: false, exact: false });
  const [busy, setBusy] = useState(false);
  const native = isAndroid();
  useEffect(() => {
    const refresh = () => {
      setP(readReminderPreferences());
      void notificationStatus()
        .then(setStatus)
        .catch(() => {});
    };
    refresh();
    window.addEventListener("noted-reminders-changed", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("resume", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("noted-reminders-changed", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("resume", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      setStatus(await notificationStatus());
    } catch (e) {
      report(
        e instanceof Error
          ? e.message
          : "Could not update reminders. Try again.",
      );
    } finally {
      setP(readReminderPreferences());
      setBusy(false);
    }
  }
  return (
    <section className="card reminder-settings">
      <h3>Notifications</h3>
      {!native ? (
        <p className="subtle">Available in the Android app.</p>
      ) : (
        <>
          <label className="reminder-toggle">
            <span>To-do reminders</span>
            <input
              type="checkbox"
              checked={p.todos}
              disabled={busy}
              onChange={(e) => {
                const enabled = e.target.checked;
                void run(async () => {
                  if (enabled) await enableNotificationPermission();
                  writeReminderPreferences({
                    ...readReminderPreferences(),
                    todos: enabled,
                  });
                  await changed();
                });
              }}
            />
          </label>
          <label className="reminder-toggle">
            <span>Weekly backup reminder</span>
            <input
              type="checkbox"
              checked={p.backup}
              disabled={busy}
              onChange={(e) => {
                const enabled = e.target.checked;
                void run(async () => {
                  if (enabled) await enableNotificationPermission();
                  const next = readReminderPreferences();
                  writeReminderPreferences({
                    ...next,
                    backup: enabled,
                    backupAnchor: Date.now(),
                  });
                  await changed();
                });
              }}
            />
          </label>
          <p className="subtle">
            Works offline. Scheduled to-dos remind you once; tap to open,
            complete, or snooze. A verified backup restarts the weekly backup
            reminder.
          </p>
          {(p.todos || p.backup) && !status.granted && (
            <p role="status">Notifications are blocked in Android Settings.</p>
          )}
          {p.todos && !status.exact && (
            <>
              <p className="subtle">
                Android may delay reminders. Allow precise timing for reminders
                at the scheduled time.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await allowPreciseReminders();
                    await changed();
                  })
                }
              >
                Allow precise timing
              </button>
            </>
          )}
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await testNotification();
                report(
                  "Test reminder set for 10 seconds from now. Lock your phone or leave Noted to check it.",
                );
              })
            }
          >
            Test notification
          </button>
          <p className="subtle">
            Hidden on the lock screen by default. Calendar reminders are
            separate; choose one app to avoid duplicate alerts.
          </p>
        </>
      )}
    </section>
  );
}
