import { and, desc, eq } from "drizzle-orm";
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
  const turns = await db.select({ id: messages.id, role: messages.role, content: messages.content, createdAt: messages.createdAt })
    .from(messages).where(and(eq(messages.conversationId, id), eq(messages.userId, userId)))
    .orderBy(messages.createdAt).limit(100);
  const [plan] = await db.select().from(actionPlans)
    .where(and(eq(actionPlans.conversationId, id), eq(actionPlans.userId, userId)))
    .orderBy(desc(actionPlans.createdAt)).limit(1);
  const [action] = plan ? await db.select().from(actions)
    .where(and(eq(actions.planId, plan.id), eq(actions.userId, userId))).limit(1) : [];
  return {
    ...conversation,
    messages: turns,
    plan: plan && action ? {
      id: plan.id,
      version: plan.version,
      status: plan.status,
      canonicalHash: plan.canonicalHash,
      action: { tool: action.type, args: action.argumentsJson },
      receipt: { status: action.status, providerObjectId: action.providerObjectId, providerLink: action.providerLink, errorCode: action.errorCode },
    } : null,
  };
}
