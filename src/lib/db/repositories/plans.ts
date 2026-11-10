import { and, eq, gt } from "drizzle-orm";
import { actionPlans, actions } from "../schema";
import { getDb } from "../client";
import type { ApprovalInput } from "../../agent/plan";

export function approvalClaimPredicate(planId: string, userId: string, input: ApprovalInput, now = new Date()) {
  return and(
    eq(actionPlans.id, planId),
    eq(actionPlans.userId, userId),
    eq(actionPlans.version, input.planVersion),
    eq(actionPlans.canonicalHash, input.canonicalHash),
    eq(actionPlans.status, "awaiting_approval"),
    gt(actionPlans.expiresAt, now),
  );
}

/** A null result means unowned, stale, expired, rejected, or already claimed. */
export async function getOwnedPendingActionTypes(planId: string, userId: string) {
  const rows = await getDb().select({ type: actions.type }).from(actionPlans)
    .innerJoin(actions, and(eq(actions.planId, actionPlans.id), eq(actions.userId, actionPlans.userId)))
    .where(and(eq(actionPlans.id, planId), eq(actionPlans.userId, userId), eq(actionPlans.status, "awaiting_approval")))
    .orderBy(actions.sequenceNo).limit(2);
  return rows.map((row) => row.type);
}

export async function claimActionPlan(planId: string, userId: string, input: ApprovalInput) {
  return getDb().transaction(async (tx) => {
    const [plan] = await tx.update(actionPlans)
      .set({ status: "executing", approvedAt: new Date(), approvalUserId: userId, approvalEventId: input.clientRequestId })
      .where(approvalClaimPredicate(planId, userId, input))
      .returning();
    if (!plan) return null;
    const claimedActions = await tx.update(actions)
      .set({ status: "executing", attemptedAt: new Date() })
      .where(and(eq(actions.planId, planId), eq(actions.userId, userId), eq(actions.status, "pending")))
      .returning();
    if (claimedActions.length < 1 || claimedActions.length > 2) throw new Error("Approved plan has invalid action count");
    return { plan, actions: claimedActions.sort((a, b) => a.sequenceNo - b.sequenceNo) };
  });
}
