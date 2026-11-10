import { calendarActionSchema, taskActionSchema, mailActionSchema } from "./proposal";

export type CalendarHistoryItem = {
  tool: "calendar.create_event";
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
    tool: "calendar.create_event",
    planId: row.planId,
    status: row.status,
    title: action.data.args.title,
    startIso: action.data.args.startIso,
    timezone: action.data.args.timezone,
    providerObjectId: row.providerObjectId,
    providerLink: safeCalendarEventLink(row.providerLink),
  };
}

export function toTaskHistoryItem(row: {
  planId: string; status: "succeeded" | "failed" | "unknown"; type: string; args: unknown;
  providerObjectId: string | null; providerLink: string | null;
}) {
  const action = taskActionSchema.safeParse({ tool: row.type, args: row.args });
  if (!action.success) return null;
  const link = row.providerLink && URL.canParse(row.providerLink) && (() => {
    const url = new URL(row.providerLink!);
    return url.protocol === "https:" && url.hostname === "tasks.google.com";
  })() ? row.providerLink : null;
  return { tool: "tasks.create_task" as const, planId: row.planId, status: row.status, title: action.data.args.title,
    dueDate: action.data.args.dueDate, providerObjectId: row.providerObjectId, providerLink: link };
}

export function toMailHistoryItem(row: {
  planId: string; status: "succeeded" | "failed" | "unknown"; type: string; args: unknown;
  providerObjectId: string | null;
}) {
  const action = mailActionSchema.safeParse({ tool: row.type, args: row.args });
  if (!action.success) return null;
  return { tool: "gmail.send" as const, planId: row.planId, status: row.status, title: action.data.args.subject,
    to: action.data.args.to, providerObjectId: row.providerObjectId, providerLink: null };
}

export function safeCalendarEventLink(value: string | null): string | null {
  if (!value || !URL.canParse(value)) return null;
  const url = new URL(value);
  return url.protocol === "https:" && ["calendar.google.com", "www.google.com"].includes(url.hostname) &&
    url.pathname.startsWith("/calendar/") ? value : null;
}
