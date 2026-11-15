"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, Pause, Play, X } from "lucide-react";
import { encodePcm16Wav, resampleMono } from "@/lib/audio/wav-encode";
import { readApiError } from "@/components/chat/types";
import { playSpeechStream } from "@/lib/audio/stream-playback";

export type VoiceReply = { text: string; language: string; review: boolean };
type Phase = "ready" | "listening" | "transcribing" | "thinking" | "speaking" | "review" | "paused" | "error";

/** One active microphone session; silence ends a turn and playback ends before listening resumes. */
export function VoiceSession({ onTurn, onClose }: { onTurn: (text: string, language: string, signal: AbortSignal) => Promise<VoiceReply>; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState("");

  const panel = useRef<HTMLDialogElement | null>(null);
  useEffect(() => { panel.current?.showModal(); const timer = setTimeout(() => void begin(), 0); return () => clearTimeout(timer);
  // Start once when the user opens voice mode; subsequent turns are managed by the session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const active = useRef(false);
  const generation = useRef(0);
  const media = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const context = useRef<AudioContext | null>(null);
  const frame = useRef<number | null>(null);
  const request = useRef<AbortController | null>(null);
  const turn = useRef(onTurn);
  useEffect(() => { turn.current = onTurn; }, [onTurn]);

  function stopResources() {
    active.current = false;
    generation.current++;
    request.current?.abort();
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    media.current?.getTracks().forEach((track) => track.stop());
    media.current = null;
    void context.current?.close();
    context.current = null;
  }
  // All browser resources belong to the visible voice panel.
  useEffect(() => () => { stopResources(); }, []);
  useEffect(() => {
    const hidden = () => { if (document.hidden) { stopResources(); setPhase("paused"); } };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);

  async function begin() {
    stopResources();
    const token = generation.current;
    setError("");
    try {
      const audioContext = new AudioContext();
      context.current = audioContext;
      await audioContext.resume();
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (token !== generation.current) { microphone.getTracks().forEach((track) => track.stop()); return; }
      media.current = microphone;
      active.current = true;
      listen(token);
    } catch {
      stopResources();
      setPhase("error");
      setError("Microphone access is unavailable. Allow microphone access, then try again or use text chat.");
    }
  }

  function listen(token: number) {
    if (!active.current || token !== generation.current || !media.current || !context.current) return;
    setPhase("listening");
    const audioContext = context.current;
    const source = audioContext.createMediaStreamSource(media.current);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const recording = new MediaRecorder(media.current);
    recorder.current = recording;
    const chunks: Blob[] = [];
    let spoken = false;
    let voicedMs = 0;
    let lastVoice = audioContext.currentTime * 1000;
    const started = audioContext.currentTime * 1000;
    let previous = started;
    recording.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recording.onstop = () => {
      source.disconnect(); analyser.disconnect();
      if (!active.current || token !== generation.current) return;
      if (!spoken || voicedMs < 200) { listen(token); return; }
      void processTurn(new Blob(chunks, { type: recording.mimeType }), token);
    };
    recording.onerror = () => { stopResources(); setPhase("error"); setError("Recording failed. Please restart voice mode."); };
    recording.start();
    function sample() {
      if (!active.current || token !== generation.current || recording.state !== "recording") return;
      analyser.getFloatTimeDomainData(samples);
      const now = audioContext.currentTime * 1000;
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
      if (rms > 0.018) { spoken = true; lastVoice = now; voicedMs += Math.min(now - previous, 100); }
      previous = now;
      if ((spoken && now - lastVoice > 900 && now - started > 1200) || now - started > 27000) { recording.stop(); return; }
      if (!spoken && now - started > 15000) { stopResources(); setPhase("paused"); return; }
      frame.current = requestAnimationFrame(sample);
    }
    frame.current = requestAnimationFrame(sample);
  }

  async function processTurn(blob: Blob, token: number) {
    const current = () => active.current && token === generation.current;
    const controller = new AbortController();
    request.current = controller;
    try {
      setPhase("transcribing");
      const decoded = await context.current!.decodeAudioData(await blob.arrayBuffer());
      if (!current()) return;
      const wav = encodePcm16Wav(resampleMono(decoded.getChannelData(0), decoded.sampleRate));
      const form = new FormData();
      form.append("audio", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "turn.wav");
      form.append("languageCandidates", JSON.stringify(["kn-IN", "en-IN", "hi-IN"]));
      const response = await fetch("/api/speech/transcribe", { method: "POST", body: form, signal: controller.signal });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json() as { transcript: string; detectedLanguageCode: string };
      if (!current()) return;
      if (!data.transcript?.trim()) throw new Error("I could not hear a clear sentence. Please try again.");

      setPhase("thinking");
      const replyLanguage = /[\u0c80-\u0cff]/u.test(data.transcript) ? "kn-IN" : /[\u0900-\u097f]/u.test(data.transcript) ? "hi-IN" : data.detectedLanguageCode;
      const result = await turn.current(data.transcript, replyLanguage, controller.signal);
      if (!current()) return;

      const synthesis = await fetch("/api/speech/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: result.text, language: result.language }), signal: controller.signal });
      if (!synthesis.ok) throw new Error(await readApiError(synthesis));
      if (!current()) { await synthesis.body?.cancel(); return; }
      await playSpeechStream(synthesis, context.current!, controller.signal, () => { if (current()) setPhase("speaking"); });
      if (!current()) return;
      if (result.review) { stopResources(); setPhase("review"); }
      else listen(token);
    } catch (cause) {
      if (!current()) return;
      stopResources();
      setPhase("error");
      setError(cause instanceof Error ? cause.message : "Voice conversation failed. Please retry.");
    }
  }

  const running = ["listening", "transcribing", "thinking", "speaking"].includes(phase);
  const labels: Record<Phase, string> = { ready: "Connecting…", listening: "Listening…", transcribing: "Understanding your speech…", thinking: "Preparing a reply…", speaking: "Kaarya is speaking", review: "Your action is ready to review", paused: "Conversation paused", error: "Voice mode needs attention" };
  return <dialog ref={panel} onCancel={() => { stopResources(); onClose(); }} aria-labelledby="voice-title" className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 text-center text-[var(--ink)] shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"><button aria-label="Close voice conversation" autoFocus className="absolute right-3 top-3 grid size-11 place-items-center rounded-full hover:bg-[var(--soft)]" onClick={() => { stopResources(); onClose(); }} type="button"><X size={20}/></button><h2 className="mt-4 text-xl font-semibold" id="voice-title">Talk with Kaarya</h2><p className="mt-2 text-sm text-[var(--muted-ink)]">Speak, pause, and hear a reply. No Send button needed.</p><div className={`voice-orb mx-auto my-9 grid size-36 place-items-center rounded-full ${running ? "voice-orb-active" : ""}`}><AudioLines size={48} className="text-white"/></div><p className="text-lg font-medium" role="status">{labels[phase]}</p><div className="mt-5 max-h-48 space-y-3 overflow-y-auto text-left text-sm leading-6">{error && <p className="text-[var(--danger)]" role="alert">{error}</p>}</div>{phase === "review" ? <button className="mt-6 min-h-11 rounded-xl bg-blue-600 px-5 font-semibold text-white" onClick={onClose} type="button">Review exact action</button> : <button className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white" onClick={() => running ? (stopResources(), setPhase("paused")) : void begin()} type="button">{running ? <Pause size={18}/> : <Play size={18}/>} {running ? "Pause" : "Resume"}</button>}<p className="mt-5 text-xs leading-5 text-[var(--muted-ink)]">Microphone stays active during this session. Pause or close to stop. Calendar, Tasks and email still need exact approval.</p></dialog>;
}
