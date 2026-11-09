import { describe, expect, it, vi } from "vitest";
import { CalendarWriteError, calendarEventId, createCalendarEvent } from "./calendar";

const id = "11111111-1111-4111-8111-111111111111";
const eventId = "11111111111141118111111111111111";
const action = { tool: "calendar.create_event" as const, args: { title: "Synthetic project meeting", startIso: "2026-11-10T17:00:00+05:30", endIso: "2026-11-10T17:30:00+05:30", timezone: "Asia/Kolkata" } };
const auth = {} as Parameters<typeof createCalendarEvent>[2];

describe("Google Calendar adapter", () => {
  it("uses a repeatable valid event ID and inserts one guest-free event", async () => {
    expect(calendarEventId(id)).toBe(eventId);
    const insert = vi.fn(async (params) => {
      expect(params.calendarId).toBe("primary");
      expect(params.requestBody.id).toBe(eventId);
      expect(params.requestBody.start.timeZone).toBe("Asia/Kolkata");
      expect(params.requestBody).not.toHaveProperty("attendees");
      return { data: { id: eventId, status: "confirmed", htmlLink: "https://calendar.google.com/calendar/event?eid=test" } };
    });
    expect(await createCalendarEvent(id, action, auth, insert)).toEqual({ providerObjectId: eventId, providerLink: "https://calendar.google.com/calendar/event?eid=test" });
    expect(insert).toHaveBeenCalledOnce();
  });

  it("never reports a missing receipt or ambiguous network failure as success", async () => {
    await expect(createCalendarEvent(id, action, auth, async () => ({ data: {} }))).rejects.toMatchObject({ outcome: "unknown" });
    await expect(createCalendarEvent(id, action, auth, async () => { throw new Error("timeout"); })).rejects.toMatchObject({ outcome: "unknown" });
    await expect(createCalendarEvent(id, action, auth, async () => { throw { response: { status: 409 } }; })).rejects.toMatchObject({ outcome: "unknown" });
    await expect(createCalendarEvent(id, action, auth, async () => { throw { response: { status: 403 } }; })).rejects.toMatchObject({ outcome: "failed" });
    expect(new CalendarWriteError("unknown", "message").outcome).toBe("unknown");
  });
});
