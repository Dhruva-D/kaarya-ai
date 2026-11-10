import { and, desc, eq, inArray } from "drizzle-orm";
import { toCalendarHistoryItem } from "../../agent/action-history";
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
  const [action] = plan ? await db.select().from(actions)
    .where(and(eq(actions.planId, plan.id), eq(actions.userId, userId))).limit(1) : [];
  const historyRows = await db.select({
    planId: actionPlans.id,
    status: actionPlans.status,
    type: actions.type,
    args: actions.argumentsJson,
    providerObjectId: actions.providerObjectId,
    providerLink: actions.providerLink,
  }).from(actionPlans).innerJoin(actions, and(eq(actions.planId, actionPlans.id), eq(actions.userId, actionPlans.userId)))
    .where(and(
      eq(actionPlans.conversationId, id),
      eq(actionPlans.userId, userId),
      inArray(actionPlans.status, ["succeeded", "failed", "unknown"]),
    )).orderBy(desc(actionPlans.createdAt)).limit(10);
  return {
    ...conversation,
    messages: turns,
    plan: plan && action ? {
      id: plan.id,
      version: plan.version,
      status: plan.status,
      expiresAt: plan.expiresAt.toISOString(),
      canonicalHash: plan.canonicalHash,
      action: { tool: action.type, args: action.argumentsJson },
      receipt: { status: action.status, providerObjectId: action.providerObjectId, providerLink: action.providerLink, meetStatus: action.meetStatus, meetLink: action.meetLink, errorCode: action.errorCode },
    } : null,
    history: historyRows.flatMap((row) => {
      if (row.status !== "succeeded" && row.status !== "failed" && row.status !== "unknown") return [];
      const item = toCalendarHistoryItem({ ...row, status: row.status });
      return item ? [item] : [];
    }),
  };
}
