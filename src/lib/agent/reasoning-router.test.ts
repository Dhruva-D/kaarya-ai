import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../integrations/codex/planner", () => ({
  CodexProposalError: class CodexProposalError extends Error { constructor(public reason: string) { super(reason); } },
  proposeWithCodex: vi.fn(),
}));
vi.mock("../integrations/gemini/planner", () => ({
  GeminiProposalError: class GeminiProposalError extends Error { constructor(public reason: string) { super(reason); } },
  proposeAction: vi.fn(),
}));

import { proposeWithCodex, CodexProposalError } from "../integrations/codex/planner";
import { GeminiProposalError, proposeAction } from "../integrations/gemini/planner";
import { proposeWithFallback, ReasoningFallbackError } from "./reasoning-router";

const input = { text: "Make a task tomorrow", timezone: "Asia/Kolkata", nowIso: "2026-11-15T09:00:00Z" };
const proposal = { kind: "needs_clarification" as const, assistantMessage: "Which task?", questions: ["Which task?"], actions: [] };

describe("reasoning model routing", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("prefers Codex and preserves the actual model", async () => {
    vi.mocked(proposeWithCodex).mockResolvedValueOnce({ proposal: { ...proposal, questions: ["Which task?"] }, model: "codex:gpt-6-luna" });
    const result = await proposeWithFallback(input, { selected: "codex-gpt-6-luna" });
    expect(result.model).toBe("codex:gpt-6-luna");
    expect(proposeAction).not.toHaveBeenCalled();
  });

  it("falls back transparently when Codex cannot run", async () => {
    vi.mocked(proposeWithCodex).mockRejectedValueOnce(new CodexProposalError("cli_unavailable"));
    vi.mocked(proposeAction).mockResolvedValueOnce({ proposal: { ...proposal, questions: ["Which task?"] }, model: "gemini-3.5-flash-lite" });
    const result = await proposeWithFallback(input, { selected: "codex-gpt-6-luna" });
    expect(result.model).toBe("gemini-3.5-flash-lite");
    expect(result.fallbackReason).toBe("cli unavailable");
  });

  it("uses an explicitly selected Gemini model without invoking Codex", async () => {
    vi.mocked(proposeAction).mockResolvedValueOnce({ proposal: { ...proposal, questions: ["Which task?"] }, model: "gemini-3.6-flash" });
    await proposeWithFallback(input, { selected: "gemini-3.6-flash" });
    expect(proposeAction).toHaveBeenCalledWith(input, expect.objectContaining({ model: "gemini-3.6-flash" }));
    expect(proposeWithCodex).not.toHaveBeenCalled();
  });

  it("reports both provider failures without pretending a proposal exists", async () => {
    vi.mocked(proposeWithCodex).mockRejectedValueOnce(new CodexProposalError("cli_unavailable"));
    vi.mocked(proposeAction).mockRejectedValueOnce(new GeminiProposalError("rate_limited"));
    await expect(proposeWithFallback(input, { selected: "codex-gpt-6-luna" })).rejects.toBeInstanceOf(ReasoningFallbackError);
  });
});
