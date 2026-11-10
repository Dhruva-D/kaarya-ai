"use client";

import { useRef, useState } from "react";
import type { Turn } from "./types";
import { readApiError } from "./types";

export function MessageList({ messages, busy, voiceAvailable }: { messages: Turn[]; busy: boolean; voiceAvailable: boolean }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function play(message: Turn) {
    if (playingId) return;
    setVoiceError(null);
    setPlayingId(message.id);
    try {
      const response = await fetch("/api/speech/synthesize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.content.slice(0, 500), language: "en-IN" }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      audioRef.current = audio;
      const finish = () => { URL.revokeObjectURL(url); audioRef.current = null; setPlayingId(null); };
      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });
      await audio.play();
    } catch (cause) {
      setPlayingId(null);
      setVoiceError(cause instanceof Error ? cause.message : "Voice reply failed. You can read the text above.");
    }
  }

  return (
    <div aria-live="polite" className="space-y-7">
      {messages.map((message) => (
        <article className={`max-w-[90%] ${message.role === "user" ? "ml-auto" : "mr-auto"}`} key={message.id}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#5A6664]">{message.role === "user" ? "You" : "Kaarya"}</p>
          <div className={`whitespace-pre-wrap break-words rounded-[14px] px-4 py-3 text-[15px] leading-7 ${message.role === "user" ? "bg-[#E7EFEC]" : "border border-[#E3E7E3] bg-white"}`}>{message.content}</div>
          {message.role === "assistant" && voiceAvailable && <button className="mt-2 min-h-11 rounded-[10px] px-3 text-sm font-medium text-[#166B61] hover:bg-[#E7EFEC] disabled:opacity-50" disabled={Boolean(playingId)} onClick={() => void play(message)} type="button">{playingId === message.id ? "Speaking…" : "Play voice reply"}</button>}
        </article>
      ))}
      {voiceError && <p className="text-sm text-[#A34236]" role="alert">{voiceError}</p>}
      {busy && <p className="text-sm text-[#5A6664]" role="status">Preparing a response…</p>}
    </div>
  );
}
