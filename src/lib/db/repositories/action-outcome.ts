import { and, eq } from "drizzle-orm";
import { getDb } from "../client";
import { actionPlans, actions } from "../schema";

export async function recordCalendarOutcome(
  userId: string,
  planId: string,
  actionId: string,
  outcome: { status: "succeeded"; providerObjectId: string; providerLink?: string; meetStatus?: "confirmed" | "pending" | "failed"; meetLink?: string } | { status: "failed" | "unknown"; errorCode: string },
) {
  await getDb().transaction(async (tx) => {
    const [updated] = await tx.update(actions).set(outcome.status === "succeeded" ? {
      status: "succeeded", provider: "google_calendar", providerObjectId: outcome.providerObjectId,
      providerLink: outcome.providerLink ?? null, meetStatus: outcome.meetStatus ?? null, meetLink: outcome.meetLink ?? null, completedAt: new Date(),
    } : {
      status: outcome.status, provider: "google_calendar", errorCode: outcome.errorCode, completedAt: new Date(),
    }).where(and(eq(actions.id, actionId), eq(actions.planId, planId), eq(actions.userId, userId), eq(actions.status, "executing"))).returning({ id: actions.id });
    if (!updated) throw new Error("Action receipt could not be saved");
    const [plan] = await tx.update(actionPlans).set({ status: outcome.status })
      .where(and(eq(actionPlans.id, planId), eq(actionPlans.userId, userId), eq(actionPlans.status, "executing")))
      .returning({ id: actionPlans.id });
    if (!plan) throw new Error("Plan receipt could not be saved");
  });
}
