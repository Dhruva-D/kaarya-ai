import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { validateWav } from "../integrations/gnani/wav";
import { encodePcm16Wav, resampleMono } from "./wav-encode";

describe("browser WAV encoding", () => {
  it("creates a valid bounded 16 kHz mono PCM clip from 48 kHz input", () => {
    const source = new Float32Array(48_000).fill(0.1);
    const wav = encodePcm16Wav(resampleMono(source, 48_000));
    expect(validateWav(Buffer.from(wav))).toEqual({ sampleRate: 16_000, durationSeconds: 1 });
    expect(wav.length).toBe(32_044);
  });

  it("rejects clips beyond the provider limit", () => {
    expect(() => resampleMono(new Float32Array(48_000 * 31), 48_000)).toThrow(/30 seconds/);
    expect(() => encodePcm16Wav(new Float32Array(16_000 * 31))).toThrow(/30 seconds/);
  });
});
