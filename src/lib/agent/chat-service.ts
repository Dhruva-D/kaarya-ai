import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { actionPlans, actions, conversations, messages, profiles } from "../db/schema";
import { proposeCalendarAction } from "../integrations/gemini/planner";
import { canonicalActionHash, validateCalendarProposal } from "./plan";
import type { ChatRequest } from "./chat-request";
import { replyCopy } from "./reply-copy";
import { calendarDetailQuestion, missingCalendarDetails } from "./calendar-slots";
import { calendarPreferenceQuestion, calendarPreferencesNeedConfirmation } from "./calendar-preferences";

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
  const recent = request.conversationId ? await db.select({ role: messages.role, content: messages.content })
    .from(messages).where(and(eq(messages.conversationId, request.conversationId), eq(messages.userId, userId)))
    .orderBy(desc(messages.createdAt)).limit(6) : [];
  const [pendingPlan] = request.conversationId ? await db.select({ id: actionPlans.id }).from(actionPlans)
    .where(and(eq(actionPlans.conversationId, request.conversationId), eq(actionPlans.userId, userId), eq(actionPlans.status, "awaiting_approval")))
    .orderBy(desc(actionPlans.createdAt)).limit(1) : [];
  const [pendingAction] = pendingPlan ? await db.select({ type: actions.type, args: actions.argumentsJson }).from(actions)
    .where(and(eq(actions.planId, pendingPlan.id), eq(actions.userId, userId))).limit(1) : [];
  const { proposal, model } = await proposeCalendarAction(
    {
      text: request.text, timezone, nowIso: new Date().toISOString(), languageCode: request.languageCode,
      recentTurns: recent.reverse().map((turn) => ({ role: turn.role, content: turn.content.slice(0, 1_000) })),
      pendingAction: pendingAction ? { tool: pendingAction.type, args: pendingAction.args } : undefined,
    },
    { apiKey: process.env.GEMINI_API_KEY ?? "", model: process.env.GEMINI_MODEL },
  );
  let action = proposal.kind === "action_plan" ? proposal.actions[0] : undefined;
  const userTurns = [...recent.filter((turn) => turn.role === "user").map((turn) => turn.content), request.text];
  const missingDetails = action ? missingCalendarDetails(userTurns, action.args.title) : [];
  const missingPreferences = action && !missingDetails.length ? calendarPreferencesNeedConfirmation(userTurns, action) : false;
  if (missingDetails.length || missingPreferences) action = undefined;
  if (action) {
    try {
      validateCalendarProposal(action, timezone, new Date(), userTurns);
    } catch {
      throw new UnsafeProposal("The proposed event needs clarification before it can be reviewed");
    }
  }
  const assistantText = missingDetails.length
    ? calendarDetailQuestion(missingDetails, request.languageCode)
    : missingPreferences
      ? calendarPreferenceQuestion(request.languageCode)
    : action
    ? replyCopy("review", request.languageCode)
    : proposal.kind === "needs_clarification"
      ? proposal.questions.join(" ")
      : replyCopy("unsupported", request.languageCode);
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
    await tx.insert(messages).values({ conversationId: currentId, userId, role: "user", content: request.text, inputMode: request.inputMode, languageCode: request.languageCode ?? "en-IN", clientRequestId: request.clientRequestId });
    await tx.insert(messages).values({ conversationId: currentId, userId, role: "assistant", content: assistantText, languageCode: request.languageCode ?? "en-IN", providerModel: model });
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
    resultType: missingDetails.length || missingPreferences ? "needs_clarification" : proposal.kind,
    questions: missingDetails.length || missingPreferences ? [assistantText] : proposal.questions,
    plan: action && planId && canonicalHash ? { id: planId, version: 1, canonicalHash, action } : null,
  };
}
