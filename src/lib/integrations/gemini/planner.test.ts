import { describe, expect, it, vi } from "vitest";
import { GeminiProposalError, proposeAction } from "./planner";

const input = { text: "Schedule a project meeting tomorrow at 5 PM for 30 minutes", timezone: "Asia/Kolkata", nowIso: "2026-11-09T10:00:00+05:30" };
const action = { tool: "calendar.create_event", args: { title: "Project meeting", startIso: "2026-11-10T17:00:00+05:30", endIso: "2026-11-10T17:30:00+05:30", timezone: "Asia/Kolkata" } };

describe("Gemini proposal adapter", () => {
  it("requests schema-bound JSON without tools or stored provider context", async () => {
    const createInteraction = vi.fn(async (params, requestOptions) => {
      expect(params.model).toBe("gemini-3.5-flash-lite");
      expect(params.store).toBe(false);
      expect(params.response_format.mime_type).toBe("application/json");
      expect(params.input).toContain("Asia/Kolkata");
      expect(params.input).toContain("Reply language: kn-IN");
      expect(params.system_instruction).toContain("every clarification question in the requested reply language");
      expect(params.input).toContain("What time?");
      expect(params.input).toContain("Current pending Calendar draft");
      expect(requestOptions.retry_codes).not.toContain("429");
      expect(requestOptions.retries.maxRetries).toBe(0);
      return { status: "completed", output_text: JSON.stringify({ kind: "action_plan", assistantMessage: "Review this event.", questions: [], actions: [action] }) };
    });
    const result = await proposeAction({ ...input, languageCode: "kn-IN", recentTurns: [{ role: "assistant", content: "What time?" }], pendingAction: action }, { apiKey: "test-key", createInteraction });
    expect(result.proposal.actions).toEqual([action]);
  });

  it("rejects unsupported tools and invented extra fields", async () => {
    const createInteraction = async () => ({ status: "completed", output_text: JSON.stringify({ kind: "action_plan", assistantMessage: "Sent it", questions: [], actions: [{ ...action, tool: "gmail.send" }] }) });
    await expect(proposeAction(input, { apiKey: "test-key", createInteraction })).rejects.toMatchObject({ reason: "invalid_response" });
    const extra = async () => ({ status: "completed", output_text: JSON.stringify({ kind: "action_plan", assistantMessage: "Review", questions: [], actions: [{ ...action, args: { ...action.args, hidden: true } }] }) });
    await expect(proposeAction(input, { apiKey: "test-key", createInteraction: extra })).rejects.toMatchObject({ reason: "invalid_response" });
  });

  it("accepts one bounded Google Task with a date-only due value", async () => {
    const task = { tool: "tasks.create_task", args: { title: "Prepare synthetic demo", dueDate: "2026-11-11" } };
    const createInteraction = async () => ({ status: "completed", output_text: JSON.stringify({ kind: "action_plan", assistantMessage: "Review this task", questions: [], actions: [task] }) });
    const result = await proposeAction(input, { apiKey: "test-key", createInteraction });
    expect(result.proposal.actions).toEqual([task]);
    const timed = async () => ({ status: "completed", output_text: JSON.stringify({ kind: "action_plan", assistantMessage: "Review", questions: [], actions: [{ ...task, args: { title: task.args.title, dueDate: "2026-11-11T17:00:00+05:30" } }] }) });
    await expect(proposeAction(input, { apiKey: "test-key", createInteraction: timed })).rejects.toMatchObject({ reason: "invalid_response" });
  });

  it("accepts one bounded Gmail draft for later approval", async () => {
    const mail = { tool: "gmail.send", args: { to: "test@example.com", subject: "Synthetic update", body: "Hello, this is a test." } };
    const createInteraction = async () => ({ status: "completed", output_text: JSON.stringify({ kind: "action_plan", assistantMessage: "Review before sending", questions: [], actions: [mail] }) });
    const result = await proposeAction(input, { apiKey: "test-key", createInteraction });
    expect(result.proposal.actions).toEqual([mail]);
  });

  it("rejects missing questions, reversed times and incomplete responses", async () => {
    const clarification = async () => ({ status: "completed", output_text: JSON.stringify({ kind: "needs_clarification", assistantMessage: "When?", questions: [], actions: [] }) });
    await expect(proposeAction(input, { apiKey: "test-key", createInteraction: clarification })).rejects.toMatchObject({ reason: "invalid_response" });
    const reversed = async () => ({ status: "completed", output_text: JSON.stringify({ kind: "action_plan", assistantMessage: "Review", questions: [], actions: [{ ...action, args: { ...action.args, endIso: "2026-11-10T16:00:00+05:30" } }] }) });
    await expect(proposeAction(input, { apiKey: "test-key", createInteraction: reversed })).rejects.toMatchObject({ reason: "invalid_response" });
    const incomplete = async () => ({ status: "failed", output_text: "{}" });
    await expect(proposeAction(input, { apiKey: "test-key", createInteraction: incomplete })).rejects.toMatchObject({ reason: "invalid_response" });
  });

  it("classifies temporary provider failure without exposing the provider body", async () => {
    const createInteraction = async () => { throw Object.assign(new Error("provider detail"), { status: 503 }); };
    await expect(proposeAction(input, { apiKey: "test-key", createInteraction })).rejects.toEqual(new GeminiProposalError("busy"));
  });

  it("uses the verified Flash-Lite fallback only when the primary model reaches its limit", async () => {
    const createInteraction = vi.fn(async (params) => {
      if (params.model === "gemini-3.6-flash") throw Object.assign(new Error("quota details"), { status: 429 });
      return { status: "completed", output_text: JSON.stringify({ kind: "action_plan", assistantMessage: "Review this event.", questions: [], actions: [action] }) };
    });
    const result = await proposeAction(input, { apiKey: "test-key", model: "gemini-3.6-flash", createInteraction });
    expect(createInteraction.mock.calls.map(([params]) => params.model)).toEqual(["gemini-3.6-flash", "gemini-3.5-flash-lite"]);
    expect(result.model).toBe("gemini-3.5-flash-lite");
    expect(result.proposal.actions).toEqual([action]);
  });
});
