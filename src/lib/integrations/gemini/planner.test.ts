import { describe, expect, it, vi } from "vitest";
import { proposeCalendarAction } from "./planner";

const input = { text: "Schedule a project meeting tomorrow at 5 PM for 30 minutes", timezone: "Asia/Kolkata", nowIso: "2026-11-09T10:00:00+05:30" };
const action = { tool: "calendar.create_event", args: { title: "Project meeting", startIso: "2026-11-10T17:00:00+05:30", endIso: "2026-11-10T17:30:00+05:30", timezone: "Asia/Kolkata" } };

describe("Gemini proposal adapter", () => {
  it("requests schema-bound JSON without tools or stored provider context", async () => {
    const createInteraction = vi.fn(async (params) => {
      expect(params.model).toBe("gemini-3.6-flash");
      expect(params.store).toBe(false);
      expect(params.response_format.mime_type).toBe("application/json");
      expect(params.input).toContain("Asia/Kolkata");
      return { status: "completed", output_text: JSON.stringify({ kind: "action_plan", assistantMessage: "Review this event.", questions: [], actions: [action] }) };
    });
    const result = await proposeCalendarAction(input, { apiKey: "test-key", createInteraction });
    expect(result.proposal.actions).toEqual([action]);
  });

  it("rejects unsupported tools and invented extra fields", async () => {
    const createInteraction = async () => ({ status: "completed", output_text: JSON.stringify({ kind: "action_plan", assistantMessage: "Sent it", questions: [], actions: [{ ...action, tool: "gmail.send" }] }) });
    await expect(proposeCalendarAction(input, { apiKey: "test-key", createInteraction })).rejects.toThrow(/contract/);
    const extra = async () => ({ status: "completed", output_text: JSON.stringify({ kind: "action_plan", assistantMessage: "Review", questions: [], actions: [{ ...action, args: { ...action.args, hidden: true } }] }) });
    await expect(proposeCalendarAction(input, { apiKey: "test-key", createInteraction: extra })).rejects.toThrow(/contract/);
  });

  it("rejects missing questions, reversed times and incomplete responses", async () => {
    const clarification = async () => ({ status: "completed", output_text: JSON.stringify({ kind: "needs_clarification", assistantMessage: "When?", questions: [], actions: [] }) });
    await expect(proposeCalendarAction(input, { apiKey: "test-key", createInteraction: clarification })).rejects.toThrow(/contract/);
    const reversed = async () => ({ status: "completed", output_text: JSON.stringify({ kind: "action_plan", assistantMessage: "Review", questions: [], actions: [{ ...action, args: { ...action.args, endIso: "2026-11-10T16:00:00+05:30" } }] }) });
    await expect(proposeCalendarAction(input, { apiKey: "test-key", createInteraction: reversed })).rejects.toThrow(/contract/);
    const incomplete = async () => ({ status: "failed", output_text: "{}" });
    await expect(proposeCalendarAction(input, { apiKey: "test-key", createInteraction: incomplete })).rejects.toThrow(/complete/);
  });
});
