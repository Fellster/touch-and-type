export const calendarNames = {
  google: "Google Calendar",
  apple: "Apple Calendar",
  outlook: "Outlook",
} as const;

export type CalendarProvider = keyof typeof calendarNames;
const preferenceKey = "noted:calendar-provider";
export function getCalendarPreference(): CalendarProvider {
  try {
    const value = localStorage.getItem(preferenceKey);
    return value === "apple" || value === "outlook" ? value : "google";
  } catch {
    return "google";
  }
}
export function saveCalendarPreference(value: CalendarProvider) {
  localStorage.setItem(preferenceKey, value);
}

export const calendarTimestamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, "");

export function downloadCalendarEvent(id: string, due: string, title: string) {
  const start = new Date(due).getTime();
  const escaped = title.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/[,;]/g, "\\$&");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Noted//Follow-up//EN",
    "BEGIN:VEVENT", `UID:${id}@notedcustomers.netlify.app`,
    `DTSTAMP:${calendarTimestamp(Date.now())}`,
    `DTSTART:${calendarTimestamp(start)}`,
    `DTEND:${calendarTimestamp(start + 15 * 60_000)}`,
    `SUMMARY:${escaped}`, "URL:https://notedcustomers.netlify.app/",
    "END:VEVENT", "END:VCALENDAR", "",
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "noted-follow-up.ics";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
