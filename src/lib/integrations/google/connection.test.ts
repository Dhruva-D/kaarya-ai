import { describe, expect, it } from "vitest";
import { hasCalendarScope } from "./connection";

describe("Google Calendar permission", () => {
  it("requires the exact Calendar scope", () => {
    expect(hasCalendarScope("openid email https://www.googleapis.com/auth/calendar.events")).toBe(true);
    expect(hasCalendarScope("openid https://www.googleapis.com/auth/calendar.events.readonly")).toBe(false);
    expect(hasCalendarScope("")).toBe(false);
  });
});
