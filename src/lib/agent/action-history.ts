import { calendarActionSchema } from "./proposal";

export type CalendarHistoryItem = {
  planId: string;
  status: "succeeded" | "failed" | "unknown";
  title: string;
  startIso: string;
  timezone: string;
  providerObjectId: string | null;
  providerLink: string | null;
};

export function toCalendarHistoryItem(row: {
  planId: string;
  status: "succeeded" | "failed" | "unknown";
  type: string;
  args: unknown;
  providerObjectId: string | null;
  providerLink: string | null;
}): CalendarHistoryItem | null {
  const action = calendarActionSchema.safeParse({ tool: row.type, args: row.args });
  if (!action.success) return null;
  try {
    new Intl.DateTimeFormat("en-IN", { timeZone: action.data.args.timezone });
  } catch {
    return null;
  }
  return {
    planId: row.planId,
    status: row.status,
    title: action.data.args.title,
    startIso: action.data.args.startIso,
    timezone: action.data.args.timezone,
    providerObjectId: row.providerObjectId,
    providerLink: safeCalendarEventLink(row.providerLink),
  };
}

export function safeCalendarEventLink(value: string | null): string | null {
  if (!value || !URL.canParse(value)) return null;
  const url = new URL(value);
  return url.protocol === "https:" && ["calendar.google.com", "www.google.com"].includes(url.hostname) &&
    url.pathname.startsWith("/calendar/") ? value : null;
}
