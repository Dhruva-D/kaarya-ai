import { describe, expect, it } from "vitest";
import { safeCalendarEventLink, toCalendarHistoryItem, toTaskHistoryItem } from "./action-history";

const valid = {
  planId: "11111111-1111-4111-8111-111111111111",
  status: "succeeded" as const,
  type: "calendar.create_event",
  args: {
    title: "Synthetic project meeting",
    startIso: "2026-11-11T17:00:00+05:30",
    endIso: "2026-11-11T17:30:00+05:30",
    timezone: "Asia/Kolkata",
  },
  providerObjectId: "test-event",
  providerLink: "https://www.google.com/calendar/event?eid=test",
};

describe("Calendar history projection", () => {
  it("shows only validated Calendar actions and safe receipt links", () => {
    expect(toCalendarHistoryItem(valid)).toMatchObject({ title: "Synthetic project meeting", providerLink: valid.providerLink });
    expect(toCalendarHistoryItem({ ...valid, type: "gmail.send" })).toBeNull();
    expect(toCalendarHistoryItem({ ...valid, args: { ...valid.args, recipient: "private@example.com" } })).toBeNull();
    expect(toCalendarHistoryItem({ ...valid, args: { ...valid.args, timezone: "not-a-timezone" } })).toBeNull();
    expect(toCalendarHistoryItem({ ...valid, providerLink: "javascript:alert(1)" })?.providerLink).toBeNull();
  });

  it("keeps only safe Google Tasks receipts", () => {
    const row = { planId: "plan", status: "succeeded" as const, type: "tasks.create_task", args: { title: "Prepare synthetic demo", dueDate: "2026-11-11" }, providerObjectId: "task-id", providerLink: "https://tasks.google.com/task/123" };
    expect(toTaskHistoryItem(row)).toMatchObject({ tool: "tasks.create_task", title: "Prepare synthetic demo", providerLink: row.providerLink });
    expect(toTaskHistoryItem({ ...row, providerLink: "javascript:alert(1)" })?.providerLink).toBeNull();
  });

  it("rejects unrelated hosts and plaintext links", () => {
    expect(safeCalendarEventLink("https://calendar.google.com.attacker.example/calendar/event")).toBeNull();
    expect(safeCalendarEventLink("http://calendar.google.com/calendar/event")).toBeNull();
  });
});
