import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), claimProviderBudget: vi.fn(), synthesizeSpeech: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/security/rate-limit", () => ({ claimProviderBudget: mocks.claimProviderBudget }));
vi.mock("@/lib/integrations/gnani/tts", async (original) => ({
  ...await original<typeof import("@/lib/integrations/gnani/tts")>(), synthesizeSpeech: mocks.synthesizeSpeech,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost:3000/api/speech/synthesize", {
    method: "POST", headers: { origin: "http://localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("voice reply route", () => {
  const prior = process.env.GNANI_API_KEY;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GNANI_API_KEY = "test-key";
    mocks.auth.mockResolvedValue({ user: { id: "owner-A" } });
    mocks.claimProviderBudget.mockResolvedValue(true);
    mocks.synthesizeSpeech.mockResolvedValue(new Uint8Array([82, 73, 70, 70]));
  });
  afterEach(() => { if (prior === undefined) delete process.env.GNANI_API_KEY; else process.env.GNANI_API_KEY = prior; });

  it("requires sign-in and rejects invalid language before spending budget", async () => {
    mocks.auth.mockResolvedValueOnce(null);
    expect((await POST(request({ text: "Hello", language: "en-IN" }))).status).toBe(401);
    expect((await POST(request({ text: "Hello", language: "auto" }))).status).toBe(400);
    expect(mocks.claimProviderBudget).not.toHaveBeenCalled();
  });

  it("returns binary WAV only after auth, validation and rate limit", async () => {
    const response = await POST(request({ text: "Hello", language: "en-IN" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/wav");
    expect(mocks.synthesizeSpeech).toHaveBeenCalledWith("Hello", "en-IN", expect.objectContaining({ apiKey: "test-key" }));
  });
});
