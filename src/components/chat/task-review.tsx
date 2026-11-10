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
    <section aria-labelledby="task-review-title" className="rounded-[14px] border border-[#D9E2DE] bg-white p-5 shadow-[0_8px_30px_rgba(34,42,43,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#166B61]">Google Tasks</p>
      <h2 className="mt-3 text-xl font-semibold tracking-tight" id="task-review-title">{pending ? "Review this task" : "Task action"}</h2>
      <p className="mt-2 text-sm leading-6 text-[#5A6664]">{pending ? "Nothing will be created until you approve these exact details." : `Status: ${expired ? "expired" : plan.status.replaceAll("_", " ")}`}</p>
      <dl className="mt-6 space-y-4 border-y border-[#E3E7E3] py-5 text-sm">
        <div><dt className="font-medium text-[#5A6664]">Task</dt><dd className="mt-1 break-words font-semibold">{plan.action.args.title}</dd></div>
        {plan.action.args.notes && <div><dt className="font-medium text-[#5A6664]">Notes</dt><dd className="mt-1 whitespace-pre-wrap break-words">{plan.action.args.notes}</dd></div>}
        <div><dt className="font-medium text-[#5A6664]">Due date</dt><dd className="mt-1">{plan.action.args.dueDate ?? "No due date"}{plan.action.args.dueDate && <span className="block text-xs text-[#5A6664]">Google Tasks saves a date only; this does not set a time or reminder.</span>}</dd></div>
        <div><dt className="font-medium text-[#5A6664]">Task list</dt><dd className="mt-1">Default Google Tasks list</dd></div>
      </dl>
      {pending && <div className="mt-5 flex flex-wrap gap-3"><button className="min-h-11 rounded-[10px] bg-[#166B61] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={onApprove} type="button">{creating ? "Creating task…" : "Approve and create"}</button><button className="min-h-11 rounded-[10px] border border-[#CBD6D2] px-4 text-sm font-medium disabled:opacity-50" disabled={busy} onClick={onReject} type="button">Cancel</button></div>}
      {plan.status === "succeeded" && plan.receipt.providerObjectId && <div className="mt-5 text-sm text-[#246B4B]"><p className="font-semibold">Task created</p><p className="mt-1 break-all">Google task ID: {plan.receipt.providerObjectId}</p>{plan.receipt.providerLink && <a className="mt-2 inline-block underline underline-offset-4" href={plan.receipt.providerLink} rel="noopener noreferrer" target="_blank">Open in Google Tasks</a>}</div>}
      {plan.status === "unknown" && <p className="mt-5 rounded-[10px] border border-[#E3D2B5] bg-[#FFF9EE] p-3 text-sm">Google Tasks may have created this task. Check your list before retrying.</p>}
      {plan.status === "failed" && <p className="mt-5 text-sm text-[#A34236]">Google Tasks did not confirm this task.</p>}
      {(plan.status === "rejected" || plan.status === "superseded" || plan.status === "expired" || expired) && <p className="mt-5 text-sm text-[#5A6664]">This preview can no longer be approved. Send a new request to continue.</p>}
    </section>
  );
}
