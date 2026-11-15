"use client";

import { useRef, useState } from "react";
import { AudioLines, Check, Copy, RotateCcw } from "lucide-react";
import { scenarios, type PrototypeLanguage } from "@/lib/prototype/scenarios";
import { VoiceSession, type VoiceReply } from "@/components/voice/voice-session";
import { MessageList } from "@/components/chat/message-list";
import type { Turn } from "@/components/chat/types";

export function PrototypeWorkspace({ voiceAvailable }: { voiceAvailable: boolean }) {
  const [selected, setSelected] = useState(scenarios[0].id);
  const [language, setLanguage] = useState<PrototypeLanguage>("en-IN");
  const [messages, setMessages] = useState<Turn[]>([]);
  const [stage, setStage] = useState(0);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const position = useRef(0);
  const scenario = scenarios.find((item) => item.id === selected)!;
  const prompt = scenario.prompts[Math.min(stage, 1)][language];

  function append(role: Turn["role"], content: string, lang: PrototypeLanguage) {
    const message: Turn = { id: crypto.randomUUID(), role, content, languageCode: lang, createdAt: new Date().toISOString() };
    setMessages((items) => [...items, message]);
    return message;
  }
  function reset(id = selected) {
    setVoice(false); setSelected(id); setMessages([]); setStage(0); position.current = 0; setText(""); setAutoSpeak(null); setCopied(false); setResetKey((value) => value + 1);
  }
  function respond(input: string, lang: PrototypeLanguage): VoiceReply {
    const index = position.current;
    append("user", input, lang);
    const response = index < 2 ? scenario.replies[index as 0 | 1][lang] : (lang === "kn-IN" ? "ದಯವಿಟ್ಟು ಮಾದರಿ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಅನುಕರಿಸಿ ಬಟನ್ ಒತ್ತಿ." : lang === "hi-IN" ? "नमूना विवरण जाँचिए और अनुकरण बटन दबाइए।" : "Please review the sample details and use the Simulate action button.");
    const message = append("assistant", response, lang);
    position.current = Math.min(index + 1, 2);
    setStage(position.current); setLanguage(lang);
    if (!voice && voiceAvailable) setAutoSpeak(message.id);
    return { text: response, language: lang, review: position.current >= 2 };
  }
  function simulate() {
    if (position.current !== 2) return;
    position.current = 3; setStage(3);
    const message = append("assistant", scenario.completion[language], language);
    if (voiceAvailable) setAutoSpeak(message.id);
  }
  async function copyScript() {
    const script = scenario.prompts.map((item, index) => `You: ${item[language]}\nKaarya: ${scenario.replies[index as 0 | 1][language]}`).join("\n\n") + `\n\n[Click Simulate action]\nKaarya: ${scenario.completion[language]}`;
    try { await navigator.clipboard.writeText(script); setCopied(true); } catch { setCopied(false); }
  }

  return <>
    {voice && <VoiceSession prototype onClose={() => setVoice(false)} onTurn={async (input, detected) => respond(input, detected === "kn-IN" || detected === "hi-IN" ? detected : "en-IN")} />}
    <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 md:px-8 lg:grid-cols-[230px_minmax(0,1fr)_320px]">
      <aside aria-label="Prototype scenarios" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3"><p className="px-3 py-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted-ink)]">Scripted scenarios</p><nav className="grid grid-cols-2 gap-1 lg:block lg:space-y-1">{scenarios.map((item) => <button aria-current={selected === item.id ? "page" : undefined} className={`min-h-12 w-full rounded-xl px-3 py-3 text-left text-sm ${selected === item.id ? "bg-[var(--soft)] font-semibold" : "hover:bg-[var(--soft)]"}`} key={item.id} onClick={() => reset(item.id)} type="button">{item.title}</button>)}</nav><p className="px-3 pt-5 text-xs leading-5 text-[var(--muted-ink)]">Fixed sample data and responses. No Calendar, Tasks, Gmail, employer or utility writes.</p></aside>
      <section className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4"><div><h1 className="text-xl font-semibold">{scenario.title}</h1><p className="mt-1 text-sm text-[var(--muted-ink)]">{scenario.description}</p></div><button aria-label="Restart scenario" className="grid size-11 place-items-center rounded-xl border border-[var(--line)] hover:bg-[var(--soft)]" onClick={() => reset()} type="button"><RotateCcw size={17}/></button></div>
        <div className="min-h-56 py-6">{messages.length ? <MessageList key={resetKey} messages={messages} busy={false} voiceAvailable={voiceAvailable} autoSpeakId={autoSpeak}/> : <div className="rounded-2xl border border-dashed border-[var(--line)] p-6"><p className="font-medium">Ready for the walkthrough</p><p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">Choose a scenario and read the suggested line aloud, or send it as text. Responses follow the selected script.</p></div>}</div>
        {stage < 2 ? <><div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"><label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-ink)]" htmlFor="script-language">Script language</label><select id="script-language" className="ml-3 min-h-11 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm" onChange={(event) => setLanguage(event.target.value as PrototypeLanguage)} value={language}><option value="en-IN">English</option><option value="kn-IN">Kannada</option><option value="hi-IN">Hindi</option></select><p className="mt-3 text-xs text-[var(--muted-ink)]">Your next line · {stage + 1} of 2</p><p className="mt-2 text-sm leading-7">{prompt}</p><button className="mt-3 min-h-11 text-sm font-medium text-[var(--accent)] underline underline-offset-4" onClick={() => { respond(prompt, language); setText(""); }} type="button">Send this line</button></div>
        <form className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3" onSubmit={(event) => { event.preventDefault(); if (text.trim()) { respond(text.trim(), language); setText(""); } }}><label className="sr-only" htmlFor="prototype-message">Prototype message</label><textarea id="prototype-message" className="min-h-20 w-full resize-y bg-transparent p-2 text-sm outline-none" maxLength={2000} onChange={(event) => setText(event.target.value)} placeholder="Type your scripted request…" value={text}/><div className="flex items-center justify-between gap-3">{voiceAvailable ? <button aria-label="Start prototype voice conversation" className="grid size-11 place-items-center rounded-xl bg-blue-600 text-white" onClick={() => { setAutoSpeak(null); setVoice(true); }} type="button"><AudioLines size={20}/></button> : <span className="text-xs text-[var(--muted-ink)]">Sign in for Gnani voice; text works here.</span>}<button className="min-h-11 rounded-xl bg-[var(--accent)] px-5 font-semibold kaarya-on-accent disabled:opacity-50" disabled={!text.trim()} type="submit">Send</button></div></form></> : null}
      </section>
      <aside aria-label="Prototype review" className="min-w-0"><div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><span className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold">{stage < 2 ? "Sample preview" : stage === 2 ? "Ready for simulation" : "Simulated receipt"}</span><h2 className="mt-5 text-lg font-semibold">{stage === 3 ? "Prototype flow complete" : "Review sample details"}</h2><dl className="mt-4 space-y-4">{scenario.fields.map((field) => <div key={field.label}><dt className="text-xs text-[var(--muted-ink)]">{field.label}</dt><dd className="mt-1 break-words text-sm leading-6">{field.value}</dd></div>)}</dl><ol className="mt-6 space-y-3 border-t border-[var(--line)] pt-5">{scenario.steps.map((step, index) => <li className="flex items-center gap-2 text-xs" key={step}>{stage === 3 ? <Check size={15} className="text-[var(--accent)]"/> : <span className="grid size-5 place-items-center rounded-full bg-[var(--soft)]">{index+1}</span>}{step}</li>)}</ol>{stage === 2 && <button className="mt-6 min-h-12 w-full rounded-xl bg-[var(--accent)] px-4 font-semibold kaarya-on-accent" onClick={simulate} type="button">Simulate action</button>}{stage === 3 && <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--soft)] p-3"><p className="text-xs font-semibold">Prototype reference</p><p className="mt-1 break-all font-mono text-xs">PROTOTYPE-{scenario.id.toUpperCase()}-001</p><p className="mt-2 text-xs leading-5">Local simulation. This is not a provider receipt or proof of submission.</p></div>}</div><button className="mt-3 inline-flex min-h-11 items-center gap-2 px-2 text-sm text-[var(--muted-ink)]" onClick={() => void copyScript()} type="button"><Copy size={15}/>{copied ? "Script copied" : "Copy full script"}</button></aside>
    </div>
  </>;
}
