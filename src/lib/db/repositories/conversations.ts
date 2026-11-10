import { and, desc, eq, inArray } from "drizzle-orm";
import { toCalendarHistoryItem, toTaskHistoryItem, toMailHistoryItem } from "../../agent/action-history";
import { getDb } from "../client";
import { actionPlans, actions, conversations, messages } from "../schema";

export async function listOwnedConversations(userId: string) {
  return getDb().select({ id: conversations.id, title: conversations.title, updatedAt: conversations.updatedAt })
    .from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt)).limit(20);
}

export async function getOwnedConversation(userId: string, id: string) {
  const db = getDb();
  const [conversation] = await db.select({ id: conversations.id, title: conversations.title })
    .from(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId))).limit(1);
  if (!conversation) return null;
  const turns = await db.select({ id: messages.id, role: messages.role, content: messages.content, languageCode: messages.languageCode, createdAt: messages.createdAt })
    .from(messages).where(and(eq(messages.conversationId, id), eq(messages.userId, userId)))
    .orderBy(messages.createdAt).limit(100);
  const [plan] = await db.select().from(actionPlans)
    .where(and(eq(actionPlans.conversationId, id), eq(actionPlans.userId, userId)))
    .orderBy(desc(actionPlans.createdAt)).limit(1);
  const planActions = plan ? await db.select().from(actions)
    .where(and(eq(actions.planId, plan.id), eq(actions.userId, userId))).orderBy(actions.sequenceNo).limit(2) : [];
  const historyRows = await db.select({
    planId: actionPlans.id,
    actionId: actions.id,
    status: actions.status,
    type: actions.type,
    args: actions.argumentsJson,
    providerObjectId: actions.providerObjectId,
    providerLink: actions.providerLink,
  }).from(actionPlans).innerJoin(actions, and(eq(actions.planId, actionPlans.id), eq(actions.userId, actionPlans.userId)))
    .where(and(
      eq(actionPlans.conversationId, id),
      eq(actionPlans.userId, userId),
      inArray(actions.status, ["succeeded", "failed", "unknown"]),
    )).orderBy(desc(actionPlans.createdAt), actions.sequenceNo).limit(10);
  return {
    ...conversation,
    messages: turns,
    plan: plan && planActions.length ? {
      id: plan.id,
      version: plan.version,
      status: plan.status,
      expiresAt: plan.expiresAt.toISOString(),
      canonicalHash: plan.canonicalHash,
      action: { tool: planActions[0].type, args: planActions[0].argumentsJson },
      receipt: { status: planActions[0].status, providerObjectId: planActions[0].providerObjectId, providerLink: planActions[0].providerLink, meetStatus: planActions[0].meetStatus, meetLink: planActions[0].meetLink, errorCode: planActions[0].errorCode },
      actions: planActions.map((item) => ({ id: item.id, action: { tool: item.type, args: item.argumentsJson }, receipt: { status: item.status, providerObjectId: item.providerObjectId, providerLink: item.providerLink, meetStatus: item.meetStatus, meetLink: item.meetLink, errorCode: item.errorCode } })),
    } : null,
    history: historyRows.flatMap((row) => {
      if (row.status !== "succeeded" && row.status !== "failed" && row.status !== "unknown") return [];
      const item = row.type === "tasks.create_task" ? toTaskHistoryItem({ ...row, status: row.status })
        : row.type === "gmail.send" ? toMailHistoryItem({ ...row, status: row.status })
          : toCalendarHistoryItem({ ...row, status: row.status });
      return item ? [{ ...item, actionId: row.actionId }] : [];
    }),
  };
}
