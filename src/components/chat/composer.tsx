"use client";

import { useState, type FormEvent } from "react";
import { VoiceRecorder } from "@/components/voice/voice-recorder";

export function Composer({ onSend, disabled, voiceAvailable }: { onSend: (text: string, languageCode?: string) => Promise<boolean>; disabled: boolean; voiceAvailable: boolean }) {
  const [text, setText] = useState("");
  const [languageCode, setLanguageCode] = useState<string | undefined>();
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value || disabled || sending) return;
    setSending(true);
    try {
      if (await onSend(value, languageCode)) { setText(""); setLanguageCode(undefined); }
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[0_5px_22px_rgba(34,42,43,0.04)] focus-within:border-[var(--accent)]" onSubmit={submit}>
      <label className="sr-only" htmlFor="message">Message Kaarya</label>
      <textarea className="min-h-20 w-full resize-y bg-transparent px-2 py-1 text-[15px] leading-6 outline-none placeholder:text-[color:var(--muted-ink)]" id="message" maxLength={2000} onChange={(event) => setText(event.target.value)} placeholder="Describe a meeting or a task…" value={text} />
      <div className="flex items-center justify-between gap-3 px-2">
        {voiceAvailable ? <VoiceRecorder onTranscript={(transcript, language) => { setText(transcript); setLanguageCode(language); }} /> : <span className="text-xs text-[color:var(--muted-ink)]">Type your request</span>}
        <button className="min-h-11 rounded-[10px] bg-[var(--accent)] px-5 text-sm font-semibold kaarya-on-accent hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50" disabled={!text.trim() || disabled || sending} type="submit">{sending ? "Sending…" : "Send"}</button>
      </div>
    </form>
  );
}
