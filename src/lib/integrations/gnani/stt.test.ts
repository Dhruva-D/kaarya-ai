import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import { GnaniTranscriptionError, transcribeWav } from "./stt";
import { validateWav } from "./wav";

function makeWav(seconds = 1, channels = 1): Buffer {
  const bytes = 16_000 * channels * 2 * seconds;
  const audio = Buffer.alloc(44 + bytes);
  audio.write("RIFF", 0);
  audio.writeUInt32LE(audio.length - 8, 4);
  audio.write("WAVEfmt ", 8);
  audio.writeUInt32LE(16, 16);
  audio.writeUInt16LE(1, 20);
  audio.writeUInt16LE(channels, 22);
  audio.writeUInt32LE(16_000, 24);
  audio.writeUInt32LE(16_000 * channels * 2, 28);
  audio.writeUInt16LE(channels * 2, 32);
  audio.writeUInt16LE(16, 34);
  audio.write("data", 36);
  audio.writeUInt32LE(bytes, 40);
  return audio;
}

describe("Gnani Prisma adapter", () => {
  it("validates the bounded PCM audio contract", () => {
    expect(validateWav(makeWav()).durationSeconds).toBe(1);
    expect(() => validateWav(makeWav(31))).toThrow(/duration/);
    expect(() => validateWav(makeWav(1, 2))).toThrow(/mono/);
    expect(() => validateWav(Buffer.from("not WAV"))).toThrow(/WAV/);
  });

  it("requests auto-detection and accepts a real-shaped v3.0 response", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toEqual({ "X-API-Key-ID": "test-key" });
      expect(init?.body).toBeInstanceOf(FormData);
      const form = init?.body as FormData;
      expect(form.get("language_code")).toBe("indic-auto");
      expect(form.get("model")).toBe("prisma-v3.0");
      expect(form.get("audio_file")).toBeInstanceOf(Blob);
      return Response.json({ success: true, transcript: "ನಮಸ್ಕಾರ", model: "prisma-v3.0", detected_language_code: "kn-IN", request_id: "test-id" });
    });
    const result = await transcribeWav(makeWav(), { apiKey: "test-key", fetchImpl });
    expect(result).toEqual({ transcript: "ನಮಸ್ಕಾರ", model: "prisma-v3.0", detectedLanguageCode: "kn-IN", requestId: "test-id" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("does not turn provider errors or another model into a success", async () => {
    await expect(transcribeWav(makeWav(), {
      apiKey: "test-key", fetchImpl: async () => new Response("private error", { status: 401 }),
    })).rejects.toThrow("HTTP 401");
    await expect(transcribeWav(makeWav(), {
      apiKey: "test-key", fetchImpl: async () => Response.json({ success: true, transcript: "hello", model: "prisma-v2.5" }),
    })).rejects.toThrow(/unsupported/);
  });

  it("classifies provider rejection and silent clips without exposing provider bodies", async () => {
    await expect(transcribeWav(makeWav(), {
      apiKey: "test-key", fetchImpl: async () => new Response("private provider body", { status: 422 }),
    })).rejects.toMatchObject({ code: "PROVIDER_HTTP", providerStatus: 422 });
    await expect(transcribeWav(makeWav(), {
      apiKey: "test-key", fetchImpl: async () => Response.json({ success: true, transcript: "  ", model: "prisma-v3.0", detected_language_code: "en-IN" }),
    })).rejects.toMatchObject({ code: "NO_SPEECH" } satisfies Partial<GnaniTranscriptionError>);
  });
});
