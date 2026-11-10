"use client";

import { useEffect, useState } from "react";
import { isApprovalPreviewLive } from "@/lib/agent/plan";
import type { MailPlan } from "./types";

export function MailReview({ plan, busy, creating, onApprove, onReject }: {
  plan: MailPlan; busy: boolean; creating: boolean; onApprove: () => Promise<void>; onReject: () => Promise<void>;
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
    <section aria-labelledby="mail-review-title" className="rounded-[14px] border border-[#D9E2DE] bg-white p-5 shadow-[0_8px_30px_rgba(34,42,43,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#166B61]">Gmail</p>
      <h2 className="mt-3 text-xl font-semibold tracking-tight" id="mail-review-title">{pending ? "Review this email" : "Email action"}</h2>
      <p className="mt-2 text-sm leading-6 text-[#5A6664]">{pending ? "This email will be sent only if you approve these exact words and recipient." : `Status: ${expired ? "expired" : plan.status.replaceAll("_", " ")}`}</p>
      <dl className="mt-6 space-y-4 border-y border-[#E3E7E3] py-5 text-sm">
        <div><dt className="font-medium text-[#5A6664]">To</dt><dd className="mt-1 break-all font-semibold">{plan.action.args.to}</dd></div>
        <div><dt className="font-medium text-[#5A6664]">Subject</dt><dd className="mt-1 break-words">{plan.action.args.subject}</dd></div>
        <div><dt className="font-medium text-[#5A6664]">Message</dt><dd className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-[10px] bg-[#F6F6F3] p-3">{plan.action.args.body}</dd></div>
      </dl>
      {pending && <div className="mt-5 flex flex-wrap gap-3"><button className="min-h-11 rounded-[10px] bg-[#166B61] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={onApprove} type="button">{creating ? "Sending email…" : "Approve and send"}</button><button className="min-h-11 rounded-[10px] border border-[#CBD6D2] px-4 text-sm font-medium disabled:opacity-50" disabled={busy} onClick={onReject} type="button">Cancel</button></div>}
      {plan.status === "succeeded" && plan.receipt.providerObjectId && <div className="mt-5 text-sm text-[#246B4B]"><p className="font-semibold">Gmail accepted the message</p><p className="mt-1 break-all">Gmail message ID: {plan.receipt.providerObjectId}</p></div>}
      {plan.status === "unknown" && <p className="mt-5 rounded-[10px] border border-[#E3D2B5] bg-[#FFF9EE] p-3 text-sm">Gmail may have sent this email. Check Sent before trying again.</p>}
      {plan.status === "failed" && <p className="mt-5 text-sm text-[#A34236]">Gmail did not confirm this email.</p>}
      {(plan.status === "rejected" || plan.status === "superseded" || plan.status === "expired" || expired) && <p className="mt-5 text-sm text-[#5A6664]">This preview can no longer be approved. Send a new request to continue.</p>}
    </section>
  );
}
