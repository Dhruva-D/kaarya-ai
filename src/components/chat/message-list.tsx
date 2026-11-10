"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Turn } from "./types";
import { readApiError } from "./types";

export function MessageList({ messages, busy, voiceAvailable, autoSpeakId }: { messages: Turn[]; busy: boolean; voiceAvailable: boolean; autoSpeakId: string | null }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<Turn | null>(null);
  const playback = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  const sequence = useRef(0);
  const lastAutoPlayed = useRef<string | null>(null);

  const play = useCallback(async (message: Turn) => {
    const current = ++sequence.current;
    if (playback.current) { playback.current.audio.pause(); URL.revokeObjectURL(playback.current.url); playback.current = null; }
    setVoiceError(null);
    setBlockedMessage(null);
    setPlayingId(message.id);
    try {
      if (message.content.length > 500) throw new Error("This reply is too long for voice. You can read the text above.");
      const response = await fetch("/api/speech/synthesize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.content, language: message.languageCode ?? "en-IN" }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      if (current !== sequence.current) return;
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      playback.current = { audio, url };
      const finish = () => { if (playback.current?.audio === audio) { URL.revokeObjectURL(url); playback.current = null; setPlayingId(null); } };
      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });
      await audio.play();
    } catch (cause) {
      if (current !== sequence.current) return;
      if (playback.current) { URL.revokeObjectURL(playback.current.url); playback.current = null; }
      setPlayingId(null);
      if (cause instanceof DOMException && cause.name === "NotAllowedError") {
        setBlockedMessage(message);
        setVoiceError("Your browser blocked automatic sound. Tap Enable sound once to hear replies.");
      } else setVoiceError(cause instanceof Error ? cause.message : "Voice reply failed. You can read the text above.");
    }
  }, []);

  useEffect(() => {
    if (!voiceAvailable || !autoSpeakId || lastAutoPlayed.current === autoSpeakId) return;
    const message = messages.find((item) => item.id === autoSpeakId && item.role === "assistant");
    if (!message) return;
    const timer = window.setTimeout(() => { lastAutoPlayed.current = autoSpeakId; void play(message); }, 0);
    return () => window.clearTimeout(timer);
  }, [autoSpeakId, messages, play, voiceAvailable]);

  useEffect(() => () => {
    sequence.current++;
    lastAutoPlayed.current = null;
    if (playback.current) { playback.current.audio.pause(); URL.revokeObjectURL(playback.current.url); playback.current = null; }
  }, []);

  return (
    <div aria-live="polite" className="space-y-7">
      {messages.map((message) => (
        <article className={`max-w-[90%] ${message.role === "user" ? "ml-auto" : "mr-auto"}`} key={message.id}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#5A6664]">{message.role === "user" ? "You" : "Kaarya"}</p>
          <div className={`whitespace-pre-wrap break-words rounded-[14px] px-4 py-3 text-[15px] leading-7 ${message.role === "user" ? "bg-[#E7EFEC]" : "border border-[#E3E7E3] bg-white"}`}>{message.content}</div>
          {message.role === "assistant" && playingId === message.id && <p className="mt-2 text-xs text-[#166B61]" role="status">Speaking…</p>}
        </article>
      ))}
      {voiceError && <p className="text-sm text-[#A34236]" role="alert">{voiceError} {blockedMessage && <button className="ml-2 underline underline-offset-2" onClick={() => void play(blockedMessage)} type="button">Enable sound</button>}</p>}
      {busy && <p className="text-sm text-[#5A6664]" role="status">Preparing a response…</p>}
    </div>
  );
}
