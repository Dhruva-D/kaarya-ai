"use client";

import { useState, type FormEvent } from "react";
import { VoiceRecorder } from "@/components/voice/voice-recorder";

export function Composer({ onSend, disabled, voiceAvailable }: { onSend: (text: string) => Promise<boolean>; disabled: boolean; voiceAvailable: boolean }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value || disabled || sending) return;
    setSending(true);
    try {
      if (await onSend(value)) setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="rounded-[14px] border border-[#CBD6D2] bg-white p-3 shadow-[0_5px_22px_rgba(34,42,43,0.04)] focus-within:border-[#166B61]" onSubmit={submit}>
      {voiceAvailable && <VoiceRecorder onTranscript={setText} />}
      <label className="sr-only" htmlFor="message">Message Kaarya</label>
      <textarea className="min-h-20 w-full resize-y bg-transparent px-2 py-1 text-[15px] leading-6 outline-none placeholder:text-[#6E7977]" id="message" maxLength={2000} onChange={(event) => setText(event.target.value)} placeholder="Describe a meeting you want to schedule…" value={text} />
      <div className="flex items-center justify-between gap-3 px-2">
        <span className="text-xs text-[#5A6664]">Type in English, Hindi or Hinglish</span>
        <button className="min-h-11 rounded-[10px] bg-[#166B61] px-5 text-sm font-semibold text-white hover:bg-[#10564F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166B61] disabled:cursor-not-allowed disabled:opacity-50" disabled={!text.trim() || disabled || sending} type="submit">{sending ? "Sending…" : "Send"}</button>
      </div>
    </form>
  );
}
