import { and, eq } from "drizzle-orm";
import { getDb } from "../client";
import { actionPlans, actions } from "../schema";

export function settledPlanStatus(statuses: Array<"pending" | "executing" | "succeeded" | "failed" | "unknown">): "succeeded" | "failed" | "unknown" | null {
  if (!statuses.length || statuses.some((status) => status === "pending" || status === "executing")) return null;
  if (statuses.includes("unknown")) return "unknown";
  if (statuses.includes("failed")) return "failed";
  return "succeeded";
}

export async function recordActionOutcome(
  userId: string,
  planId: string,
  actionId: string,
  provider: "google_calendar" | "google_tasks" | "gmail",
  outcome: { status: "succeeded"; providerObjectId: string; providerLink?: string; meetStatus?: "confirmed" | "pending" | "failed"; meetLink?: string } | { status: "failed" | "unknown"; errorCode: string },
) {
  await getDb().transaction(async (tx) => {
    const [updated] = await tx.update(actions).set(outcome.status === "succeeded" ? {
      status: "succeeded", provider, providerObjectId: outcome.providerObjectId,
      providerLink: outcome.providerLink ?? null, meetStatus: outcome.meetStatus ?? null, meetLink: outcome.meetLink ?? null, completedAt: new Date(),
    } : {
      status: outcome.status, provider, errorCode: outcome.errorCode, completedAt: new Date(),
    }).where(and(eq(actions.id, actionId), eq(actions.planId, planId), eq(actions.userId, userId), eq(actions.status, "executing"))).returning({ id: actions.id });
    if (!updated) throw new Error("Action receipt could not be saved");
    const rows = await tx.select({ status: actions.status }).from(actions)
      .where(and(eq(actions.planId, planId), eq(actions.userId, userId)));
    const finalStatus = settledPlanStatus(rows.map((row) => row.status));
    if (finalStatus) {
      const [plan] = await tx.update(actionPlans).set({ status: finalStatus })
        .where(and(eq(actionPlans.id, planId), eq(actionPlans.userId, userId), eq(actionPlans.status, "executing")))
        .returning({ id: actionPlans.id });
      if (!plan) throw new Error("Plan receipt could not be saved");
    }
  });
}
