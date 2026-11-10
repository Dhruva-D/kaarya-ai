"use client";

import { useEffect, useState } from "react";
import { isApprovalPreviewLive } from "@/lib/agent/plan";
import type { BatchPlan, PlanAction } from "./types";

function summary(action: PlanAction) {
  if (action.tool === "calendar.create_event") return {
    service: "Google Calendar", title: action.args.title,
    details: [
      `Starts: ${new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeStyle: "short", timeZone: action.args.timezone }).format(new Date(action.args.startIso))}`,
      `Ends: ${new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeStyle: "short", timeZone: action.args.timezone }).format(new Date(action.args.endIso))}`,
      `Time zone: ${action.args.timezone}`,
      `Guests: ${action.args.attendees?.length ? action.args.attendees.join(", ") + " — invitations will be sent" : "None"}`,
      `Google Meet: ${action.args.addMeet ? "Request a new link" : "No Meet link"}`,
    ],
  };
  if (action.tool === "tasks.create_task") return { service: "Google Tasks", title: action.args.title,
    details: [`Due: ${action.args.dueDate ?? "No due date"} (date only; no reminder)`, ...(action.args.notes ? [`Notes: ${action.args.notes}`] : [])] };
  return { service: "Gmail", title: action.args.subject, details: [`To: ${action.args.to}`, `Subject: ${action.args.subject}`, `Body: ${action.args.body}`] };
}

export function BatchReview({ plan, busy, creating, onApprove, onReject }: {
  plan: BatchPlan; busy: boolean; creating: boolean; onApprove: () => Promise<void>; onReject: () => Promise<void>;
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
  const partial = plan.status === "failed" && plan.actions.some((item) => item.receipt.status === "succeeded");
  const statusLabel = expired ? "expired" : partial ? "partially completed" : plan.status.replaceAll("_", " ");
  return <section aria-labelledby="batch-review-title" className="rounded-[14px] border border-[#D9E2DE] bg-white p-5 shadow-[0_8px_30px_rgba(34,42,43,0.04)]">
    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#166B61]">Action plan</p>
    <h2 id="batch-review-title" className="mt-3 text-xl font-semibold tracking-tight">Review both actions</h2>
    <p className="mt-2 text-sm leading-6 text-[#5A6664]">{pending ? "Both actions will run only after you approve these exact details." : `Status: ${statusLabel}`}</p>
    <ol className="mt-5 space-y-4">{plan.actions.map((item, index) => {
      const info = summary(item.action);
      return <li className="min-w-0 rounded-[10px] border border-[#E3E7E3] bg-[#FAFBF9] p-4" key={item.id}>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#166B61]">{index + 1}. {info.service}</p>
        <h3 className="mt-2 break-words text-sm font-semibold">{info.title}</h3>
        <dl className="mt-3 space-y-1 text-sm leading-6 text-[#5A6664]">{info.details.map((detail, detailIndex) => <div className="break-words whitespace-pre-wrap" key={detailIndex}>{detail}</div>)}</dl>
        {!pending && item.receipt.status !== "pending" && item.receipt.status !== "executing" && <p className={`mt-3 text-sm font-semibold ${item.receipt.status === "succeeded" ? "text-[#166B61]" : "text-[#8E392F]"}`}>Result: {item.receipt.status.replaceAll("_", " ")}{item.receipt.providerObjectId ? ` · Google ID: ${item.receipt.providerObjectId}` : ""}</p>}
        {!pending && item.receipt.status === "unknown" && <p className="mt-2 text-xs leading-5 text-[#8E392F]">Check {info.service} before making another request.</p>}
      </li>;
    })}</ol>
    {pending && <div className="mt-5 flex flex-wrap gap-3"><button className="min-h-11 rounded-[10px] bg-[#166B61] px-4 text-sm font-semibold text-white hover:bg-[#10564F] disabled:opacity-50" disabled={busy} onClick={onApprove} type="button">{creating ? "Carrying out actions…" : "Approve both actions"}</button><button className="min-h-11 rounded-[10px] border border-[#CBD6D2] px-4 text-sm font-medium hover:bg-[#F6F6F3] disabled:opacity-50" disabled={busy} onClick={onReject} type="button">Cancel both</button></div>}
    {expired && <p className="mt-5 text-sm leading-6 text-[#5A6664]">This preview can no longer be approved. Send a new request to continue.</p>}
  </section>;
}
