import { createHash } from "node:crypto";
import { z } from "zod";
import type { Proposal } from "./proposal";

export const approvalInputSchema = z.strictObject({
  planVersion: z.number().int().positive(),
  canonicalHash: z.string().regex(/^[a-f0-9]{64}$/),
  confirmation: z.literal(true),
  clientRequestId: z.uuid(),
});

export type ApprovalInput = z.infer<typeof approvalInputSchema>;
export type CalendarAction = Extract<Proposal["actions"][number], { tool: "calendar.create_event" }>;
export type TaskAction = Extract<Proposal["actions"][number], { tool: "tasks.create_task" }>;
export type MailAction = Extract<Proposal["actions"][number], { tool: "gmail.send" }>;
export type ProposedAction = CalendarAction | TaskAction | MailAction;

export function isApprovalPreviewLive(status: string, expiresAt: string, now = Date.now()): boolean {
  const expiry = Date.parse(expiresAt);
  return status === "awaiting_approval" && Number.isFinite(expiry) && expiry > now;
}

export function canonicalActionHash(action: ProposedAction): string {
  return createHash("sha256").update(JSON.stringify(action)).digest("hex");
}

export function validateCalendarProposal(
  action: CalendarAction,
  userTimezone: string,
  now = new Date(),
  userTurns?: string[],
): CalendarAction {
  const { startIso, endIso, timezone } = action.args;
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (timezone !== userTimezone) throw new Error("Event timezone does not match the user profile");
  if (start <= now.getTime()) throw new Error("Event start must be in the future");
  if (end - start > 8 * 60 * 60 * 1_000) throw new Error("Event duration exceeds eight hours");
  if (start - now.getTime() > 366 * 24 * 60 * 60 * 1_000) throw new Error("Event date is too far in the future");
  if (action.args.attendees?.length && userTurns) {
    const source = userTurns.join(" ").toLowerCase();
    for (const email of action.args.attendees) {
      if (!source.includes(email.toLowerCase())) throw new Error("Guest email was not supplied by the user");
    }
  }
  return action;
}
