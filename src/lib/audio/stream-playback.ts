/** Decode the documented Gnani SSE chunks and schedule raw 24 kHz PCM as it arrives. */
export async function playSpeechStream(response: Response, context: AudioContext, signal: AbortSignal, onAudio: () => void) {
  if (!response.body) throw new Error("Speech stream was empty");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let scheduled = context.currentTime;
  let bytes = 0;
  let complete = false;
  let hasAudio = false;
  let carry: number | undefined;
  const sources = new Set<AudioBufferSourceNode>();
  const stop = () => { for (const source of sources) { source.stop(); } void reader.cancel(); };
  signal.addEventListener("abort", stop, { once: true });
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      pending += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, "\n");
      bytes += chunk.value.length;
      if (bytes > 8_000_000) throw new Error("Speech stream exceeded its limit");
      let boundary: number;
      while ((boundary = pending.indexOf("\n\n")) >= 0) {
        const block = pending.slice(0, boundary); pending = pending.slice(boundary + 2);
        const event = block.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
        const data = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
        if (!data) continue;
        if (event === "error") throw new Error("Gnani interrupted the speech stream");
        const payload = JSON.parse(data) as { audio?: string; is_final?: boolean };
        if (event === "complete" || payload.is_final) complete = true;
        if (!payload.audio) continue;
        const binary = atob(payload.audio);
        const pcm = new Uint8Array(binary.length + (carry === undefined ? 0 : 1));
        let offset = 0;
        if (carry !== undefined) pcm[offset++] = carry;
        for (let i = 0; i < binary.length; i++) pcm[offset + i] = binary.charCodeAt(i);
        carry = pcm.length % 2 ? pcm[pcm.length - 1] : undefined;
        const length = Math.floor(pcm.length / 2);
        if (!length) continue;
        hasAudio = true;
        const audio = context.createBuffer(1, length, 24000);
        const channel = audio.getChannelData(0);
        const view = new DataView(pcm.buffer);
        for (let i = 0; i < length; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
        const source = context.createBufferSource();
        source.buffer = audio; source.connect(context.destination);
        source.onended = () => { sources.delete(source); source.disconnect(); };
        sources.add(source);
        scheduled = Math.max(scheduled, context.currentTime + 0.03);
        source.start(scheduled); scheduled += audio.duration;
        onAudio();
      }
    }
    if (!complete || !hasAudio) throw new Error("Speech stream ended before completion");
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, Math.max(0, (scheduled - context.currentTime) * 1000));
      signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Stopped", "AbortError")); }, { once: true });
    });
  } catch (error) { stop(); throw error; }
  finally { signal.removeEventListener("abort", stop); reader.releaseLock(); }
}
