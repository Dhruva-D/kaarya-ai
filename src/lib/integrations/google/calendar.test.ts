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

  it("sends invitations only for reviewed guests and requests a unique Meet", async () => {
    const withGuests = { ...action, args: { ...action.args, attendees: ["guest@example.com"], addMeet: true } };
    const insert = vi.fn(async (params) => {
      expect(params.sendUpdates).toBe("all");
      expect(params.conferenceDataVersion).toBe(1);
      expect(params.requestBody.attendees).toEqual([{ email: "guest@example.com" }]);
      expect(params.requestBody.conferenceData.createRequest).toMatchObject({ requestId: id, conferenceSolutionKey: { type: "hangoutsMeet" } });
      return { data: { id: eventId, status: "confirmed", hangoutLink: "https://meet.google.com/abc-defg-hij", conferenceData: { createRequest: { status: { statusCode: "success" } } } } };
    });
    expect(await createCalendarEvent(id, withGuests, auth, insert)).toEqual({ providerObjectId: eventId, providerLink: undefined, meetStatus: "confirmed", meetLink: "https://meet.google.com/abc-defg-hij" });
  });

  it("does not claim Meet success while Google is pending", async () => {
    const withMeet = { ...action, args: { ...action.args, addMeet: true } };
    const receipt = await createCalendarEvent(id, withMeet, auth, async () => ({ data: { id: eventId, status: "confirmed", conferenceData: { createRequest: { status: { statusCode: "pending" } } } } }));
    expect(receipt.meetStatus).toBe("pending");
    expect(receipt.meetLink).toBeUndefined();
  });
});
