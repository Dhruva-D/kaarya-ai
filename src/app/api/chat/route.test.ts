import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), handleChat: vi.fn(), claimProviderBudget: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/agent/chat-service", () => ({
  handleChat: mocks.handleChat,
  ConversationNotFound: class extends Error {},
  UnsafeProposal: class extends Error {},
}));
vi.mock("@/lib/security/rate-limit", () => ({ claimProviderBudget: mocks.claimProviderBudget }));

import { GeminiProposalError } from "@/lib/integrations/gemini/planner";
import { POST } from "./route";

const body = { text: "Schedule a synthetic meeting tomorrow at 5 PM", inputMode: "text", clientRequestId: "11111111-1111-4111-8111-111111111111" };
function request() {
  return new Request("http://localhost:3000/api/chat", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("chat provider failures", () => {
  const priorKey = process.env.GEMINI_API_KEY;
  const priorDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
    process.env.DATABASE_URL = "postgresql://local.invalid/test";
    mocks.auth.mockResolvedValue({ user: { id: "owner-A" } });
    mocks.claimProviderBudget.mockResolvedValue(true);
  });

  afterEach(() => {
    if (priorKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = priorKey;
    if (priorDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = priorDatabaseUrl;
  });

  it("returns a useful retry message when Gemini is busy", async () => {
    mocks.handleChat.mockRejectedValue(new GeminiProposalError("busy"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "GEMINI_BUSY", message: expect.stringContaining("try Send again") });
  });

  it("distinguishes an invalid provider plan from temporary availability", async () => {
    mocks.handleChat.mockRejectedValue(new GeminiProposalError("invalid_response"));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "GEMINI_INVALID_RESPONSE" });
  });

  it("reports the provider request limit as 429", async () => {
    mocks.handleChat.mockRejectedValue(new GeminiProposalError("rate_limited"));
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "GEMINI_RATE_LIMITED", message: expect.stringContaining("Google AI Studio") });
  });
});
