import { Buffer } from "node:buffer";

export type WavInfo = { sampleRate: number; durationSeconds: number };

/** Accept the narrow PCM format our first browser recorder will produce. */
export function validateWav(audio: Buffer): WavInfo {
  if (audio.byteLength < 44 || audio.byteLength > 3_000_000) {
    throw new Error("WAV file must be between 44 bytes and 3 MB");
  }
  if (audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Expected a RIFF/WAVE file");
  }

  let format: { encoding: number; channels: number; sampleRate: number; bits: number } | undefined;
  let dataBytes = 0;
  for (let offset = 12; offset + 8 <= audio.byteLength; ) {
    const name = audio.toString("ascii", offset, offset + 4);
    const size = audio.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    if (dataStart + size > audio.byteLength) throw new Error("Truncated WAV chunk");
    if (name === "fmt ") {
      if (size < 16) throw new Error("Invalid WAV format chunk");
      format = {
        encoding: audio.readUInt16LE(dataStart),
        channels: audio.readUInt16LE(dataStart + 2),
        sampleRate: audio.readUInt32LE(dataStart + 4),
        bits: audio.readUInt16LE(dataStart + 14),
      };
    }
    if (name === "data") dataBytes += size;
    offset = dataStart + size + (size % 2);
  }

  if (!format || format.encoding !== 1 || format.channels !== 1 || format.bits !== 16) {
    throw new Error("Expected mono 16-bit PCM WAV audio");
  }
  if (format.sampleRate < 8_000 || format.sampleRate > 44_100) {
    throw new Error("WAV sample rate must be 8–44.1 kHz");
  }
  const durationSeconds = dataBytes / (format.sampleRate * 2);
  if (durationSeconds < 0.1 || durationSeconds > 30) {
    throw new Error("WAV duration must be 0.1–30 seconds");
  }
  return { sampleRate: format.sampleRate, durationSeconds };
}
