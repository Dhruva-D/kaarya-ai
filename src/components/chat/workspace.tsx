"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActionReview } from "./action-review";
import { TaskReview } from "./task-review";
import { MailReview } from "./mail-review";
import { BatchReview } from "./batch-review";
import { ActionHistory } from "./action-history";
import { Composer } from "./composer";
import { MessageList } from "./message-list";
import { readApiError, type CalendarPlan, type TaskPlan, type MailPlan, type BatchPlan, type ConversationDetail, type ConversationSummary } from "./types";

export function Workspace({ signOutControl, voiceAvailable }: { signOutControl: ReactNode; voiceAvailable: boolean }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [autoSpeakId, setAutoSpeakId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadDetail = useCallback(async (id: string) => {
    const response = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
    if (!response.ok) throw new Error(await readApiError(response));
    const next = await response.json() as ConversationDetail;
    setDetail(next);
    return next;
  }, []);

  const refreshSummaries = useCallback(async () => {
    const response = await fetch("/api/conversations", { cache: "no-store" });
    if (!response.ok) throw new Error(await readApiError(response));
    const data = await response.json() as { conversations: ConversationSummary[] };
    setConversations(data.conversations);
    return data.conversations;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const items = await refreshSummaries();
        if (!cancelled && items[0]) {
          setActiveId(items[0].id);
          await loadDetail(items[0].id);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Conversations could not be loaded");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void restore();
    return () => { cancelled = true; };
  }, [loadDetail, refreshSummaries]);

  async function selectConversation(id: string) {
    setMenuOpen(false);
    setAutoSpeakId(null);
    setActiveId(id);
    setDetail(null);
    setError(null);
    try { await loadDetail(id); } catch (cause) { setError(cause instanceof Error ? cause.message : "Conversation could not be loaded"); }
  }

  async function send(text: string, languageCode?: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId ?? undefined, text, inputMode: languageCode ? "voice" : "text", languageCode, clientRequestId: crypto.randomUUID() }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const result = await response.json() as { conversationId: string };
      setActiveId(result.conversationId);
      const loaded = await loadDetail(result.conversationId);
      const latest = loaded.messages.at(-1);
      if (voiceAvailable && latest?.role === "assistant") setAutoSpeakId(latest.id);
      await refreshSummaries();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Message could not be sent");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function decide(kind: "approve" | "reject") {
    if (!detail?.plan || busy) return;
    const plan = detail.plan;
    setBusy(true);
    setDecisionBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/plans/${plan.id}/${kind}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "approve" ? {
          planVersion: plan.version, canonicalHash: plan.canonicalHash,
          confirmation: true, clientRequestId: crypto.randomUUID(),
        } : { planVersion: plan.version }),
      });
      if (!response.ok && response.status !== 202) throw new Error(await readApiError(response));
      await loadDetail(detail.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `The outcome could not be confirmed. Check ${plan.action.tool === "gmail.send" ? "Gmail Sent" : plan.action.tool === "tasks.create_task" ? "Google Tasks" : "Google Calendar"} before trying again.`);
      await loadDetail(detail.id).catch(() => undefined);
    } finally {
      setBusy(false);
      setDecisionBusy(false);
    }
  }

  const plan = detail?.plan;
  const history = detail?.history.filter((item) => item.planId !== plan?.id) ?? [];
  const hasSidePanel = Boolean(plan || history.length);
  return (
    <div className={`mx-auto grid min-h-[calc(100vh-76px)] max-w-[1600px] ${hasSidePanel ? "lg:grid-cols-[240px_minmax(0,1fr)_340px]" : "lg:grid-cols-[240px_minmax(0,1fr)]"}`}>
      <aside className={`${menuOpen ? "block" : "hidden"} border-b border-[#E3E7E3] bg-[#F6F6F3] p-5 lg:block lg:border-b-0 lg:border-r`} aria-label="Conversations">
        <button className="min-h-11 w-full rounded-[10px] border border-[#CBD6D2] bg-white px-4 text-left text-sm font-semibold hover:bg-[#EEF3F0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166B61]" onClick={() => { setActiveId(null); setDetail(null); setAutoSpeakId(null); setError(null); setMenuOpen(false); }} type="button">+ New conversation</button>
        <h2 className="mt-9 text-xs font-semibold uppercase tracking-[0.12em] text-[#5A6664]">Recent conversations</h2>
        <nav className="mt-3 space-y-1" aria-label="Recent conversations">
          {conversations.length === 0 && <p className="text-sm leading-6 text-[#5A6664]">Your conversations will appear here.</p>}
          {conversations.map((item) => <button aria-current={item.id === activeId ? "page" : undefined} className={`block w-full truncate rounded-[10px] px-3 py-2.5 text-left text-sm hover:bg-[#E7EFEC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166B61] ${item.id === activeId ? "bg-[#E7EFEC] font-semibold" : ""}`} key={item.id} onClick={() => void selectConversation(item.id)} title={item.title} type="button">{item.title}</button>)}
        </nav>
      </aside>

      <section className="flex min-h-[calc(100vh-76px)] min-w-0 flex-col px-5 pb-6 pt-5 sm:px-8 lg:px-10" aria-label="Chat workspace">
        <div className="flex items-center justify-between gap-3 border-b border-[#E3E7E3] pb-4 lg:justify-end">
          <button className="min-h-11 rounded-[10px] border border-[#CBD6D2] px-3 text-sm lg:hidden" onClick={() => setMenuOpen(!menuOpen)} type="button">Conversations</button>
          {signOutControl}
        </div>
        <div className="mx-auto flex w-full max-w-[780px] flex-1 flex-col">
          {loading ? <p className="pt-12 text-sm text-[#5A6664]" role="status">Loading your workspace…</p> : detail?.messages.length ? <div className="flex-1 py-10"><MessageList autoSpeakId={autoSpeakId} busy={busy && !decisionBusy} messages={detail.messages} voiceAvailable={voiceAvailable} /></div> : <div className="flex flex-1 flex-col justify-center py-12"><p className="text-sm font-semibold text-[#166B61]">YOUR WORKSPACE</p><h1 className="mt-4 max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">What would you like to get done?</h1><p className="mt-4 max-w-xl text-[15px] leading-7 text-[#5A6664]">Describe a meeting or task. I’ll ask for missing details and show the exact action before you decide whether to create it.</p></div>}
          {error && <div className="mb-4 rounded-[10px] border border-[#E4C9C4] bg-[#FFF7F5] px-4 py-3 text-sm text-[#8E392F]" role="alert">{error}</div>}
          <div className="sticky bottom-0 bg-[#F6F6F3] pb-2 pt-3"><Composer disabled={busy || loading} onSend={send} voiceAvailable={voiceAvailable} /><p className="mt-3 text-xs leading-5 text-[#5A6664]">{voiceAvailable ? "Review and edit the transcript before sending. Voice is processed only when you press Record." : "Voice input is unavailable right now. You can type your request above."}</p></div>
        </div>
      </section>

      {hasSidePanel && <aside className="min-w-0 border-t border-[#E3E7E3] bg-[#F6F6F3] p-5 lg:border-l lg:border-t-0 lg:p-6" aria-label="Action review"><div className="lg:sticky lg:top-6">{plan && plan.actions?.length === 2 ? <BatchReview busy={busy} creating={decisionBusy} key={plan.id} onApprove={() => decide("approve")} onReject={() => decide("reject")} plan={plan as BatchPlan} /> : <>{plan?.action.tool === "calendar.create_event" && <ActionReview busy={busy} creating={decisionBusy} key={plan.id} onApprove={() => decide("approve")} onReject={() => decide("reject")} plan={plan as CalendarPlan} />}{plan?.action.tool === "tasks.create_task" && <TaskReview busy={busy} creating={decisionBusy} key={plan.id} onApprove={() => decide("approve")} onReject={() => decide("reject")} plan={plan as TaskPlan} />}{plan?.action.tool === "gmail.send" && <MailReview busy={busy} creating={decisionBusy} key={plan.id} onApprove={() => decide("approve")} onReject={() => decide("reject")} plan={plan as MailPlan} />}</>}<ActionHistory items={history} /></div></aside>}
    </div>
  );
}
