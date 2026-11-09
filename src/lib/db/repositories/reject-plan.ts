import { and, eq } from "drizzle-orm";
import { getDb } from "../client";
import { actionPlans } from "../schema";

export async function rejectOwnedPlan(userId: string, planId: string, version: number): Promise<boolean> {
  const [rejected] = await getDb().update(actionPlans).set({ status: "rejected" })
    .where(and(eq(actionPlans.id, planId), eq(actionPlans.userId, userId), eq(actionPlans.version, version), eq(actionPlans.status, "awaiting_approval")))
    .returning({ id: actionPlans.id });
  return Boolean(rejected);
}
