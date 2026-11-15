"use client";

import { useEffect, useState } from "react";
import { isApprovalPreviewLive } from "@/lib/agent/plan";
import type { TaskPlan } from "./types";

export function TaskReview({ plan, busy, creating, onApprove, onReject }: {
  plan: TaskPlan; busy: boolean; creating: boolean; onApprove: () => Promise<void>; onReject: () => Promise<void>;
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
    <section aria-labelledby="task-review-title" className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_8px_30px_rgba(34,42,43,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--accent)]">Google Tasks</p>
      <h2 className="mt-3 text-xl font-semibold tracking-tight" id="task-review-title">{pending ? "Review this task" : "Task action"}</h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted-ink)]">{pending ? "Nothing will be created until you approve these exact details." : `Status: ${expired ? "expired" : plan.status.replaceAll("_", " ")}`}</p>
      <dl className="mt-6 space-y-4 border-y border-[var(--line)] py-5 text-sm">
        <div><dt className="font-medium text-[color:var(--muted-ink)]">Task</dt><dd className="mt-1 break-words font-semibold">{plan.action.args.title}</dd></div>
        {plan.action.args.notes && <div><dt className="font-medium text-[color:var(--muted-ink)]">Notes</dt><dd className="mt-1 whitespace-pre-wrap break-words">{plan.action.args.notes}</dd></div>}
        <div><dt className="font-medium text-[color:var(--muted-ink)]">Due date</dt><dd className="mt-1">{plan.action.args.dueDate ?? "No due date"}{plan.action.args.dueDate && <span className="block text-xs text-[color:var(--muted-ink)]">Google Tasks saves a date only; this does not set a time or reminder.</span>}</dd></div>
        <div><dt className="font-medium text-[color:var(--muted-ink)]">Task list</dt><dd className="mt-1">Default Google Tasks list</dd></div>
      </dl>
      {pending && <p className="mt-4 text-xs leading-5 text-[color:var(--muted-ink)]">Need a change? Type a correction below. Kaarya will replace this preview before you approve.</p>}
      {pending && <div className="mt-5 flex flex-wrap gap-3"><button className="min-h-11 rounded-[10px] bg-[var(--accent)] px-4 text-sm font-semibold kaarya-on-accent disabled:opacity-50" disabled={busy} onClick={onApprove} type="button">{creating ? "Creating task…" : "Approve and create"}</button><button className="min-h-11 rounded-[10px] border border-[var(--line)] px-4 text-sm font-medium disabled:opacity-50" disabled={busy} onClick={onReject} type="button">Cancel</button></div>}
      {plan.status === "succeeded" && plan.receipt.providerObjectId && <div className="mt-5 text-sm text-[var(--success)]"><p className="font-semibold">Task created</p><p className="mt-1 break-all">Google task ID: {plan.receipt.providerObjectId}</p>{plan.receipt.providerLink && <a className="mt-2 inline-block underline underline-offset-4" href={plan.receipt.providerLink} rel="noopener noreferrer" target="_blank">Open in Google Tasks</a>}</div>}
      {plan.status === "unknown" && <p className="mt-5 rounded-[10px] border border-[var(--warning-line)] bg-[var(--warning-bg)] p-3 text-sm">Google Tasks may have created this task. Check your list before retrying.</p>}
      {plan.status === "failed" && <p className="mt-5 text-sm text-[var(--danger)]">Google Tasks did not confirm this task.</p>}
      {(plan.status === "rejected" || plan.status === "superseded" || plan.status === "expired" || expired) && <p className="mt-5 text-sm text-[color:var(--muted-ink)]">This preview can no longer be approved. Send a new request to continue.</p>}
    </section>
  );
}
