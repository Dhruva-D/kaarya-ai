"use client";

import { useEffect, useRef, useState } from "react";
import { encodePcm16Wav, resampleMono } from "@/lib/audio/wav-encode";
import { readApiError } from "@/components/chat/types";

type VoiceState = "idle" | "recording" | "processing" | "transcribing";
const languageNames: Record<string, string> = { "bn-IN": "Bengali", "en-IN": "English", "gu-IN": "Gujarati", "hi-IN": "Hindi", "kn-IN": "Kannada", "ml-IN": "Malayalam", "mr-IN": "Marathi", "pa-IN": "Punjabi", "ta-IN": "Tamil", "te-IN": "Telugu" };

export function VoiceRecorder({ onTranscript }: { onTranscript: (text: string, languageCode: string) => void }) {
  const [state, setState] = useState<VoiceState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    cancelled.current = true;
    if (timer.current) clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function transcribe() {
    setState("processing");
    let context: AudioContext | undefined;
    try {
      context = new AudioContext();
      const blob = new Blob(chunks.current, { type: recorder.current?.mimeType });
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      if (decoded.duration < 0.1 || decoded.duration > 30) throw new Error("Keep recordings between 0.1 and 30 seconds");
      const wav = encodePcm16Wav(resampleMono(decoded.getChannelData(0), decoded.sampleRate));
      const form = new FormData();
      form.append("audio", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "speech.wav");
      setState("transcribing");
      const response = await fetch("/api/speech/transcribe", { method: "POST", body: form });
      if (!response.ok) throw new Error(await readApiError(response));
      const result = await response.json() as { transcript: string; model: string; detectedLanguageCode: string };
      if (!result.transcript.trim() || result.model !== "prisma-v3.0" || !languageNames[result.detectedLanguageCode]) throw new Error("Gnani did not return a valid transcript");
      setDetectedLanguage(languageNames[result.detectedLanguageCode]);
      onTranscript(result.transcript, result.detectedLanguageCode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Voice transcription failed. You can type instead.");
    } finally {
      if (context) await context.close();
      chunks.current = [];
      setState("idle");
      setSeconds(0);
    }
  }

  async function start() {
    setError(null);
    setDetectedLanguage(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser cannot record audio. You can type your request instead.");
      return;
    }
    try {
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      stream.current = microphone;
      chunks.current = [];
      cancelled.current = false;
      const media = new MediaRecorder(microphone);
      recorder.current = media;
      media.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      media.onerror = () => {
        cancelled.current = true;
        setError("Recording stopped unexpectedly. You can retry or type instead.");
        if (media.state === "recording") media.stop();
      };
      media.onstop = () => {
        microphone.getTracks().forEach((track) => track.stop());
        stream.current = null;
        if (timer.current) clearInterval(timer.current);
        if (cancelled.current) { chunks.current = []; setState("idle"); setSeconds(0); }
        else void transcribe();
      };
      media.start();
      setSeconds(0);
      setState("recording");
      const started = Date.now();
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1_000);
        setSeconds(elapsed);
        if (elapsed >= 29 && media.state === "recording") media.stop();
      }, 250);
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      setError("Microphone access was unavailable. You can type your request instead.");
    }
  }

  function stop(cancel = false) {
    cancelled.current = cancel;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  return (
    <div className="mb-3 rounded-[10px] border border-[#E3E7E3] bg-[#F6F6F3] px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        {state === "idle" ? <button className="min-h-11 rounded-[10px] border border-[#CBD6D2] bg-white px-4 font-medium hover:bg-[#E7EFEC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166B61]" onClick={() => void start()} type="button">Record voice</button> : null}
        {state === "recording" ? <>
          <span className="font-medium text-[#A34236]" role="status">Recording… 00:{String(seconds).padStart(2, "0")}</span>
          <button className="min-h-11 rounded-[10px] bg-[#166B61] px-4 font-medium text-white" onClick={() => stop()} type="button">Stop and transcribe</button>
          <button className="min-h-11 rounded-[10px] px-3 underline underline-offset-4" onClick={() => stop(true)} type="button">Discard</button>
        </> : null}
        {state === "processing" && <span role="status">Preparing WAV audio…</span>}
        {state === "transcribing" && <span role="status">Transcribing with Gnani Prisma…</span>}
        <span className="ml-auto text-xs text-[#5A6664]">{detectedLanguage ? `Detected ${detectedLanguage}` : "Language detected automatically"}</span>
      </div>
      {error && <p className="mt-2 text-sm text-[#A34236]" role="alert">{error}</p>}
    </div>
  );
}
