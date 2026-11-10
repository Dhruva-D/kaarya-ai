import { describe, expect, it } from "vitest";
import { calendarPreferenceQuestion, calendarPreferencesNeedConfirmation } from "./calendar-preferences";

const action = { tool: "calendar.create_event" as const, args: { title: "Synthetic discussion", startIso: "2026-11-11T17:00:00+05:30", endIso: "2026-11-11T17:30:00+05:30", timezone: "Asia/Kolkata", attendees: [] as string[], addMeet: false } };

describe("Calendar guest and Meet decisions", () => {
  it("does not finalize when either choice is missing", () => {
    expect(calendarPreferencesNeedConfirmation(["Schedule a synthetic discussion tomorrow at five for 30 minutes"], action)).toBe(true);
    expect(calendarPreferencesNeedConfirmation(["No guests"], action)).toBe(true);
    expect(calendarPreferenceQuestion("kn-IN")).toContain("Google Meet");
  });
  it("accepts explicit no/no and rejects invented guest or Meet", () => {
    expect(calendarPreferencesNeedConfirmation(["No guests and no Google Meet"], action)).toBe(false);
    expect(calendarPreferencesNeedConfirmation(["No guests and no Google Meet"], { ...action, args: { ...action.args, addMeet: true } })).toBe(true);
    expect(calendarPreferencesNeedConfirmation(["No guests and no Google Meet"], { ...action, args: { ...action.args, attendees: ["guest@example.com"] } })).toBe(true);
  });
  it("accepts exact guest email and Meet request across turns", () => {
    const invited = { ...action, args: { ...action.args, attendees: ["guest@example.com"], addMeet: true } };
    expect(calendarPreferencesNeedConfirmation(["Invite guest@example.com", "Add a Google Meet link"], invited)).toBe(false);
    expect(calendarPreferencesNeedConfirmation(["Invite someone", "Add a Google Meet link"], invited)).toBe(true);
  });
});
