import { describe, expect, it, vi } from "vitest";
import { synthesizeSpeech } from "./tts";

const wav = new Uint8Array(44);
wav.set(new TextEncoder().encode("RIFF"), 0);
wav.set(new TextEncoder().encode("WAVE"), 8);

describe("Gnani Timbre adapter", () => {
  it("uses a documented Kannada voice and returns only WAV audio", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toEqual({ "X-API-Key-ID": "test-key", "Content-Type": "application/json" });
      const payload = JSON.parse(String(init?.body));
      expect(payload).toMatchObject({ text: "ನಮಸ್ಕಾರ", model: "timbre-v2.5", voice: "Saanvi", language: "kn-IN" });
      return new Response(wav, { headers: { "Content-Type": "audio/wav" } });
    });
    expect(await synthesizeSpeech("ನಮಸ್ಕಾರ", "kn-IN", { apiKey: "test-key", fetchImpl })).toEqual(wav);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects provider errors and non-audio responses", async () => {
    await expect(synthesizeSpeech("Hello", "en-IN", { apiKey: "test-key", fetchImpl: async () => new Response("secret error", { status: 403 }) }))
      .rejects.toMatchObject({ code: "PROVIDER_HTTP", providerStatus: 403 });
    await expect(synthesizeSpeech("Hello", "en-IN", { apiKey: "test-key", fetchImpl: async () => Response.json({ success: true }) }))
      .rejects.toMatchObject({ code: "INVALID_AUDIO" });
  });
});
