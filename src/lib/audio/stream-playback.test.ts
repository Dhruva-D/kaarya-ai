import { describe, expect, it, vi } from "vitest";
import { playSpeechStream } from "./stream-playback";

describe("streamed speech playback", () => {
  it("handles split SSE frames and schedules signed little endian PCM", async () => {
    const samples = new Float32Array(2);
    const start = vi.fn();
    const audio = { currentTime: 0, destination: {}, createBuffer: () => ({ duration: 0, getChannelData: () => samples }), createBufferSource: () => ({ connect: vi.fn(), disconnect: vi.fn(), start, stop: vi.fn() }) } as unknown as AudioContext;
    const raw = 'event: chunk\ndata: {"audio":"AID/fw=="}\n\nevent: complete\ndata: {"is_final":true}\n\n';
    const response = new Response(new ReadableStream({ start(controller) { const bytes = new TextEncoder().encode(raw); controller.enqueue(bytes.slice(0, 22)); controller.enqueue(bytes.slice(22)); controller.close(); } }));
    const onAudio = vi.fn();
    await playSpeechStream(response, audio, new AbortController().signal, onAudio);
    expect(start).toHaveBeenCalledOnce();
    expect(samples[0]).toBe(-1);
    expect(samples[1]).toBeCloseTo(1, 3);
    expect(onAudio).toHaveBeenCalledOnce();
  });
  it("rejects an empty or interrupted provider response", async () => {
    const context = { currentTime: 0 } as AudioContext;
    await expect(playSpeechStream(new Response('event: complete\ndata: {"is_final":true}\n\n'), context, new AbortController().signal, vi.fn())).rejects.toThrow("before completion");
  });
});
