import { describe, expect, it } from "vitest";
import { approvalInputSchema, canonicalActionHash, isApprovalPreviewLive, validateCalendarProposal } from "./plan";

const action = { tool: "calendar.create_event" as const, args: { title: "Synthetic project meeting", startIso: "2026-11-10T17:00:00+05:30", endIso: "2026-11-10T17:30:00+05:30", timezone: "Asia/Kolkata" } };

describe("Calendar plan review", () => {
  it("binds a stable hash to the exact reviewed arguments", () => {
    expect(canonicalActionHash(action)).toMatch(/^[a-f0-9]{64}$/);
    expect(canonicalActionHash(action)).not.toBe(canonicalActionHash({ ...action, args: { ...action.args, title: "Changed" } }));
  });

  it("rejects an unconfirmed or forged approval payload", () => {
    const valid = { planVersion: 1, canonicalHash: canonicalActionHash(action), confirmation: true, clientRequestId: "11111111-1111-4111-8111-111111111111" };
    expect(approvalInputSchema.safeParse(valid).success).toBe(true);
    expect(approvalInputSchema.safeParse({ ...valid, confirmation: false }).success).toBe(false);
    expect(approvalInputSchema.safeParse({ ...valid, tool: "gmail.send" }).success).toBe(false);
  });

  it("refuses wrong timezone, past and excessively long events", () => {
    const now = new Date("2026-11-09T10:00:00Z");
    expect(validateCalendarProposal(action, "Asia/Kolkata", now)).toEqual(action);
    expect(() => validateCalendarProposal(action, "UTC", now)).toThrow(/timezone/);
    expect(() => validateCalendarProposal(action, "Asia/Kolkata", new Date("2026-11-11T00:00:00Z"))).toThrow(/future/);
    expect(() => validateCalendarProposal({ ...action, args: { ...action.args, endIso: "2026-11-11T04:00:00+05:30" } }, "Asia/Kolkata", now)).toThrow(/duration/);
    const guestAction = { ...action, args: { ...action.args, attendees: ["guest@example.com"] } };
    expect(() => validateCalendarProposal(guestAction, "Asia/Kolkata", now, ["Invite guest@example.com"])).not.toThrow();
    expect(() => validateCalendarProposal(guestAction, "Asia/Kolkata", now, ["Invite someone"])).toThrow(/Guest email/);
  });

  it("closes approval at expiry and fails closed on invalid timestamps", () => {
    const expiry = "2026-11-10T12:00:00.000Z";
    const before = Date.parse("2026-11-10T11:59:59.999Z");
    expect(isApprovalPreviewLive("awaiting_approval", expiry, before)).toBe(true);
    expect(isApprovalPreviewLive("awaiting_approval", expiry, Date.parse(expiry))).toBe(false);
    expect(isApprovalPreviewLive("succeeded", expiry, before)).toBe(false);
    expect(isApprovalPreviewLive("awaiting_approval", "invalid", before)).toBe(false);
  });
});
