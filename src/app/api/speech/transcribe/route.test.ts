import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GnaniTranscriptionError } from "@/lib/integrations/gnani/stt";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  claimProviderBudget: vi.fn(),
  transcribeWav: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/security/rate-limit", () => ({ claimProviderBudget: mocks.claimProviderBudget }));
vi.mock("@/lib/integrations/gnani/stt", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/integrations/gnani/stt")>(),
  transcribeWav: mocks.transcribeWav,
}));

import { POST } from "./route";

function wav(): Uint8Array {
  const bytes = new Uint8Array(44 + 32_000);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, bytes.length - 8, true); text(8, "WAVEfmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16_000, true); view.setUint32(28, 32_000, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, 32_000, true);
  return bytes;
}

function request(audio = wav()) {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "speech.wav");
  form.append("languageCode", "en-IN");
  return new Request("http://localhost:3000/api/speech/transcribe", {
    method: "POST", headers: { origin: "http://localhost:3000" }, body: form,
  });
}

describe("voice transcription route", () => {
  const priorKey = process.env.GNANI_API_KEY;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GNANI_API_KEY = "test-key";
    mocks.auth.mockResolvedValue({ user: { id: "owner-A" } });
    mocks.claimProviderBudget.mockResolvedValue(true);
  });
  afterEach(() => {
    if (priorKey === undefined) delete process.env.GNANI_API_KEY;
    else process.env.GNANI_API_KEY = priorKey;
  });

  it("rejects malformed audio before spending provider budget", async () => {
    const response = await POST(request(new Uint8Array(100)));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_AUDIO");
    expect(mocks.claimProviderBudget).not.toHaveBeenCalled();
    expect(mocks.transcribeWav).not.toHaveBeenCalled();
  });

  it("reports provider rejection without returning its private body", async () => {
    mocks.transcribeWav.mockRejectedValue(new GnaniTranscriptionError("PROVIDER_HTTP", "Gnani transcription failed (HTTP 422)", 422));
    const response = await POST(request());
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.code).toBe("GNANI_REJECTED");
    expect(JSON.stringify(body)).not.toContain("private provider body");
  });

  it("gives a useful no-speech response", async () => {
    mocks.transcribeWav.mockRejectedValue(new GnaniTranscriptionError("NO_SPEECH", "Gnani did not detect speech in this clip"));
    const response = await POST(request());
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("NO_SPEECH");
  });
});
