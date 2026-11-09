import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { actionPlans, actions, conversations, messages, profiles } from "../db/schema";
import { proposeCalendarAction } from "../integrations/gemini/planner";
import { canonicalActionHash, validateCalendarProposal } from "./plan";
import type { ChatRequest } from "./chat-request";

export class ConversationNotFound extends Error {}
export class UnsafeProposal extends Error {}

export async function handleChat(userId: string, request: ChatRequest) {
  const db = getDb();
  if (request.conversationId) {
    const [owned] = await db.select({ id: conversations.id }).from(conversations)
      .where(and(eq(conversations.id, request.conversationId), eq(conversations.userId, userId))).limit(1);
    if (!owned) throw new ConversationNotFound("Conversation not found");
  }
  const [profile] = await db.select({ timezone: profiles.timezone }).from(profiles)
    .where(eq(profiles.userId, userId)).limit(1);
  const timezone = profile?.timezone ?? "Asia/Kolkata";
  const { proposal, model } = await proposeCalendarAction(
    { text: request.text, timezone, nowIso: new Date().toISOString() },
    { apiKey: process.env.GEMINI_API_KEY ?? "", model: process.env.GEMINI_MODEL },
  );
  const action = proposal.kind === "action_plan" ? proposal.actions[0] : undefined;
  if (action) {
    try {
      validateCalendarProposal(action, timezone);
    } catch {
      throw new UnsafeProposal("The proposed event needs clarification before it can be reviewed");
    }
  }
  const assistantText = action
    ? "Please review this event before I create it."
    : proposal.kind === "needs_clarification"
      ? `I need a little more detail before I can prepare the event. ${proposal.questions.join(" ")}`
      : "I can only help create Calendar events right now.";
  const planId = action ? randomUUID() : undefined;
  const actionId = action ? randomUUID() : undefined;
  const canonicalHash = action ? canonicalActionHash(action) : undefined;

  const conversationId = await db.transaction(async (tx) => {
    let currentId = request.conversationId;
    if (!currentId) {
      const [created] = await tx.insert(conversations).values({ userId, title: request.text.slice(0, 80) }).returning({ id: conversations.id });
      currentId = created.id;
    }
    await tx.update(actionPlans).set({ status: "superseded" })
      .where(and(eq(actionPlans.conversationId, currentId), eq(actionPlans.userId, userId), eq(actionPlans.status, "awaiting_approval")));
    await tx.insert(messages).values({ conversationId: currentId, userId, role: "user", content: request.text, inputMode: request.inputMode, clientRequestId: request.clientRequestId });
    await tx.insert(messages).values({ conversationId: currentId, userId, role: "assistant", content: assistantText, providerModel: model });
    await tx.update(conversations).set({ updatedAt: new Date() })
      .where(and(eq(conversations.id, currentId), eq(conversations.userId, userId)));
    if (action && planId && actionId && canonicalHash) {
      await tx.insert(actionPlans).values({ id: planId, userId, conversationId: currentId, version: 1, status: "awaiting_approval", canonicalHash, expiresAt: new Date(Date.now() + 15 * 60_000) });
      await tx.insert(actions).values({ id: actionId, planId, userId, type: action.tool, argumentsJson: action.args, status: "pending", executionKey: randomUUID() });
    }
    return currentId;
  });

  return {
    conversationId,
    assistantText,
    resultType: proposal.kind,
    questions: proposal.questions,
    plan: action && planId && canonicalHash ? { id: planId, version: 1, canonicalHash, action } : null,
  };
}
