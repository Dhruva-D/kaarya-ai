/** Convert browser decoded audio to the bounded mono PCM format used by Gnani REST. */
export function resampleMono(input: Float32Array, inputRate: number, outputRate = 16_000): Float32Array {
  if (!Number.isFinite(inputRate) || inputRate < 8_000 || inputRate > 192_000) throw new Error("Unsupported input sample rate");
  if (input.length === 0 || input.length / inputRate > 30) throw new Error("Recording must be 0.1–30 seconds");
  const count = Math.round(input.length * outputRate / inputRate);
  const output = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * inputRate / outputRate);
    const end = Math.min(input.length, Math.max(start + 1, Math.floor((i + 1) * inputRate / outputRate)));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    output[i] = sum / (end - start);
  }
  return output;
}

export function encodePcm16Wav(samples: Float32Array, sampleRate = 16_000): Uint8Array {
  if (samples.length / sampleRate < 0.1 || samples.length / sampleRate > 30) throw new Error("Recording must be 0.1–30 seconds");
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, value < 0 ? value * 32768 : value * 32767, true);
  }
  return bytes;
}
