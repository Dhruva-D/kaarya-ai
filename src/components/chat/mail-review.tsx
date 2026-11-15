"use client";

import { useEffect, useState } from "react";
import { isApprovalPreviewLive } from "@/lib/agent/plan";
import type { MailPlan } from "./types";

export function MailReview({ plan, busy, creating, onApprove, onReject, senderEmail }: {
  plan: MailPlan; busy: boolean; creating: boolean; senderEmail: string | null; onApprove: () => Promise<void>; onReject: () => Promise<void>;
}) {
  const [, refreshExpiry] = useState(0);
  useEffect(() => {
    if (plan.status !== "awaiting_approval") return;
    const remaining = Date.parse(plan.expiresAt) - Date.now();
    const timer = setTimeout(() => refreshExpiry((value) => value + 1), Math.max(0, remaining + 50));
    return () => clearTimeout(timer);
  }, [plan.expiresAt, plan.status]);
  const pending = isApprovalPreviewLive(plan.status, plan.expiresAt);
  const expired = plan.status === "awaiting_approval" && !pending;
  return (
    <section aria-labelledby="mail-review-title" className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_8px_30px_rgba(34,42,43,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--accent)]">Gmail</p>
      <h2 className="mt-3 text-xl font-semibold tracking-tight" id="mail-review-title">{pending ? "Review this email" : "Email action"}</h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted-ink)]">{pending ? "This email will be sent only if you approve these exact words and recipient." : `Status: ${expired ? "expired" : plan.status.replaceAll("_", " ")}`}</p>
      <dl className="mt-6 space-y-4 border-y border-[var(--line)] py-5 text-sm">
        <div><dt className="font-medium text-[color:var(--muted-ink)]">From</dt><dd className="mt-1 break-all">{senderEmail ?? "Connected Google account unavailable"}</dd></div>
        <div><dt className="font-medium text-[color:var(--muted-ink)]">To</dt><dd className="mt-1 break-all font-semibold">{plan.action.args.to}</dd></div>
        <div><dt className="font-medium text-[color:var(--muted-ink)]">Subject</dt><dd className="mt-1 break-words">{plan.action.args.subject}</dd></div>
        <div><dt className="font-medium text-[color:var(--muted-ink)]">Message</dt><dd className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-[10px] bg-[var(--canvas)] p-3">{plan.action.args.body}</dd></div>
      </dl>
      {pending && <p className="mt-4 text-xs leading-5 text-[color:var(--muted-ink)]">Need a change? Type a correction below. Kaarya will replace this preview before you approve.</p>}
      {pending && <div className="mt-5 flex flex-wrap gap-3"><button className="min-h-11 rounded-[10px] bg-[var(--accent)] px-4 text-sm font-semibold kaarya-on-accent disabled:opacity-50" disabled={busy || !senderEmail} onClick={onApprove} type="button">{creating ? "Sending email…" : "Approve and send"}</button><button className="min-h-11 rounded-[10px] border border-[var(--line)] px-4 text-sm font-medium disabled:opacity-50" disabled={busy} onClick={onReject} type="button">Cancel</button></div>}
      {plan.status === "succeeded" && plan.receipt.providerObjectId && <div className="mt-5 text-sm text-[var(--success)]"><p className="font-semibold">Gmail accepted the message</p><p className="mt-1 break-all">Gmail message ID: {plan.receipt.providerObjectId}</p></div>}
      {plan.status === "unknown" && <p className="mt-5 rounded-[10px] border border-[var(--warning-line)] bg-[var(--warning-bg)] p-3 text-sm">Gmail may have sent this email. Check Sent before trying again.</p>}
      {plan.status === "failed" && <p className="mt-5 text-sm text-[var(--danger)]">Gmail did not confirm this email.</p>}
      {(plan.status === "rejected" || plan.status === "superseded" || plan.status === "expired" || expired) && <p className="mt-5 text-sm text-[color:var(--muted-ink)]">This preview can no longer be approved. Send a new request to continue.</p>}
    </section>
  );
}
