import { google } from "googleapis";
import type { CalendarAction } from "../../agent/plan";

type CalendarAuth = InstanceType<typeof google.auth.OAuth2>;

type InsertParams = {
  calendarId: "primary";
  requestBody: {
    id: string;
    summary: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
  };
};
type InsertResult = { data: { id?: string | null; htmlLink?: string | null; status?: string | null } };
type EventInsert = (params: InsertParams) => Promise<InsertResult>;

export class CalendarWriteError extends Error {
  constructor(public readonly outcome: "failed" | "unknown", message: string) {
    super(message);
  }
}

export function calendarEventId(actionId: string): string {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(actionId)) {
    throw new Error("Invalid action ID");
  }
  return actionId.replaceAll("-", "");
}

export async function createCalendarEvent(
  actionId: string,
  action: CalendarAction,
  auth: CalendarAuth,
  insertOverride?: EventInsert,
): Promise<{ providerObjectId: string; providerLink?: string }> {
  const eventId = calendarEventId(actionId);
  const insert = insertOverride ?? (async (params: InsertParams) => {
    const response = await google.calendar({ version: "v3", auth }).events.insert(params, { timeout: 30_000 });
    return { data: response.data };
  });
  let result: InsertResult;
  try {
    result = await insert({
      calendarId: "primary",
      requestBody: {
        id: eventId,
        summary: action.args.title,
        start: { dateTime: action.args.startIso, timeZone: action.args.timezone },
        end: { dateTime: action.args.endIso, timeZone: action.args.timezone },
      },
    });
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status && status >= 400 && status < 500 && status !== 409) {
      throw new CalendarWriteError("failed", `Calendar rejected the event (HTTP ${status})`);
    }
    throw new CalendarWriteError("unknown", "Calendar may have created the event, but confirmation was lost");
  }
  if (!result.data.id || result.data.id !== eventId || (result.data.status && result.data.status !== "confirmed")) {
    throw new CalendarWriteError("unknown", "Calendar did not return a confirmed event ID");
  }
  const link = result.data.htmlLink;
  const safeLink = link && URL.canParse(link) && (() => {
    const url = new URL(link);
    return url.protocol === "https:" && ["calendar.google.com", "www.google.com"].includes(url.hostname) && url.pathname.startsWith("/calendar/");
  })() ? link : undefined;
  return { providerObjectId: result.data.id, providerLink: safeLink };
}
