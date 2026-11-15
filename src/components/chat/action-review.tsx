"use client";

import { useEffect, useState } from "react";
import { isApprovalPreviewLive } from "@/lib/agent/plan";
import type { CalendarPlan } from "./types";

function formatWhen(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeStyle: "short", timeZone: timezone }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ActionReview({ plan, busy, creating, onApprove, onReject }: {
  plan: CalendarPlan;
  busy: boolean;
  creating: boolean;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
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
    <section aria-labelledby="review-title" className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_8px_30px_rgba(34,42,43,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--accent)]">Google Calendar</p>
      <h2 className="mt-3 text-xl font-semibold tracking-tight" id="review-title">{pending ? "Review this event" : "Calendar action"}</h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted-ink)]">{pending ? "Nothing will be created until you approve these exact details." : `Status: ${expired ? "expired" : plan.status.replaceAll("_", " ")}`}</p>
      <dl className="mt-6 space-y-4 border-y border-[var(--line)] py-5 text-sm">
        <div><dt className="font-medium text-[color:var(--muted-ink)]">Title</dt><dd className="mt-1 break-words font-semibold">{plan.action.args.title}</dd></div>
        <div><dt className="font-medium text-[color:var(--muted-ink)]">Starts</dt><dd className="mt-1">{formatWhen(plan.action.args.startIso, plan.action.args.timezone)}</dd></div>
        <div><dt className="font-medium text-[color:var(--muted-ink)]">Ends</dt><dd className="mt-1">{formatWhen(plan.action.args.endIso, plan.action.args.timezone)}</dd></div>
        <div><dt className="font-medium text-[color:var(--muted-ink)]">Time zone</dt><dd className="mt-1">{plan.action.args.timezone}</dd></div>
        <div><dt className="font-medium text-[color:var(--muted-ink)]">Guests</dt><dd className="mt-1 break-all">{plan.action.args.attendees?.length ? `${plan.action.args.attendees.join(", ")} — Google Calendar will email invitations` : "None; no invitations will be sent"}</dd></div>
        <div><dt className="font-medium text-[color:var(--muted-ink)]">Google Meet</dt><dd className="mt-1">{plan.action.args.addMeet ? "Request a new link" : "No Meet link"}</dd></div>
      </dl>
      {pending && <p className="mt-4 text-xs leading-5 text-[color:var(--muted-ink)]">Need a change? Type a correction below. Kaarya will replace this preview before you approve.</p>}
      {pending && <div className="mt-5 flex flex-wrap gap-3">
        <button className="min-h-11 rounded-[10px] bg-[var(--accent)] px-4 text-sm font-semibold kaarya-on-accent hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50" disabled={busy} onClick={onApprove} type="button">{creating ? "Creating event…" : "Approve and create"}</button>
        <button className="min-h-11 rounded-[10px] border border-[var(--line)] px-4 text-sm font-medium hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50" disabled={busy} onClick={onReject} type="button">Cancel</button>
      </div>}
      {plan.status === "succeeded" && plan.receipt.providerObjectId && <div className="mt-5 text-sm text-[var(--success)]"><p className="font-semibold">Event created</p><p className="mt-1 break-all">Google event ID: {plan.receipt.providerObjectId}</p>{plan.receipt.providerLink && <a className="mt-2 inline-block underline underline-offset-4" href={plan.receipt.providerLink} rel="noopener noreferrer" target="_blank">Open in Google Calendar</a>}{plan.action.args.addMeet && <p className="mt-2">{plan.receipt.meetStatus === "confirmed" && plan.receipt.meetLink ? <a href={plan.receipt.meetLink} rel="noopener noreferrer" target="_blank" className="underline underline-offset-4">Open Google Meet</a> : plan.receipt.meetStatus === "failed" ? "Google Meet was not created. Check Calendar before sharing this event." : "Google Meet is not confirmed yet. Check Calendar for its status."}</p>}</div>}
      {plan.status === "unknown" && <p className="mt-5 rounded-[10px] border border-[var(--warning-line)] bg-[var(--warning-bg)] p-3 text-sm leading-6">Calendar may have created this event, but confirmation was lost. Check Calendar before trying again.</p>}
      {plan.status === "failed" && <p className="mt-5 text-sm text-[var(--danger)]">Calendar did not confirm this event. You can send a new request after checking the details.</p>}
      {(plan.status === "rejected" || plan.status === "superseded" || plan.status === "expired" || expired) && <p className="mt-5 text-sm text-[color:var(--muted-ink)]">This preview can no longer be approved. Send a new request to continue.</p>}
    </section>
  );
}
