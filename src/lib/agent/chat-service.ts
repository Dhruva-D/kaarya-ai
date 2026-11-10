import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { actionPlans, actions, conversations, messages, profiles } from "../db/schema";
import { proposeAction } from "../integrations/gemini/planner";
import { canonicalPlanHash, validateCalendarProposal, type ProposedAction } from "./plan";
import type { ChatRequest } from "./chat-request";
import { replyCopy } from "./reply-copy";
import { calendarDetailQuestion, missingCalendarDetails } from "./calendar-slots";
import { calendarPreferenceQuestion, calendarPreferencesNeedConfirmation } from "./calendar-preferences";
import { validateTaskProposal } from "./task-plan";
import { missingTaskDetails, taskDetailQuestion } from "./task-slots";
import { recipientQuestion, recipientWasSupplied, validateMailProposal } from "./mail-plan";

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
  const pendingActions = pendingPlan ? await db.select({ type: actions.type, args: actions.argumentsJson }).from(actions)
    .where(and(eq(actions.planId, pendingPlan.id), eq(actions.userId, userId))).orderBy(actions.sequenceNo).limit(2) : [];
  const { proposal, model } = await proposeAction(
    {
      text: request.text, timezone, nowIso: new Date().toISOString(), languageCode: request.languageCode,
      recentTurns: recent.reverse().map((turn) => ({ role: turn.role, content: turn.content.slice(0, 1_000) })),
      pendingAction: pendingActions.length ? pendingActions.map((item) => ({ tool: item.type, args: item.args })) : undefined,
    },
    { apiKey: process.env.GEMINI_API_KEY ?? "", model: process.env.GEMINI_MODEL },
  );
  let proposed = proposal.kind === "action_plan" ? proposal.actions : [];
  const userTurns = [...recent.filter((turn) => turn.role === "user").map((turn) => turn.content), request.text];
  const calendar = proposed.find((item) => item.tool === "calendar.create_event");
  const task = proposed.find((item) => item.tool === "tasks.create_task");
  const mail = proposed.find((item) => item.tool === "gmail.send");
  const missingDetails = calendar ? missingCalendarDetails(userTurns, calendar.args.title) : [];
  const missingTask = task ? missingTaskDetails(userTurns, task) : [];
  const missingRecipient = mail ? !recipientWasSupplied(mail, userTurns) : false;
  const missingPreferences = calendar && !missingDetails.length ? calendarPreferencesNeedConfirmation(userTurns, calendar) : false;
  if (missingDetails.length || missingTask.length || missingPreferences || missingRecipient) proposed = [];
  if (proposed.length) {
    try {
      for (const action of proposed) {
        if (action.tool === "calendar.create_event") validateCalendarProposal(action, timezone, new Date(), userTurns);
        else if (action.tool === "tasks.create_task") validateTaskProposal(action);
        else validateMailProposal(action, userTurns);
      }
    } catch {
      throw new UnsafeProposal("The proposed action needs clarification before it can be reviewed");
    }
  }
  const assistantText = missingDetails.length
    ? calendarDetailQuestion(missingDetails, request.languageCode)
    : missingTask.length
      ? taskDetailQuestion(missingTask, request.languageCode)
    : missingRecipient
      ? recipientQuestion(request.languageCode)
    : missingPreferences
      ? calendarPreferenceQuestion(request.languageCode)
    : proposed.length
    ? proposed.length === 2 ? replyCopy("batch_review", request.languageCode) : replyCopy(proposed[0].tool === "gmail.send" ? "mail_review" : proposed[0].tool === "tasks.create_task" ? "task_review" : "review", request.languageCode)
    : proposal.kind === "needs_clarification"
      ? proposal.questions.join(" ")
      : replyCopy("unsupported", request.languageCode);
  const planId = proposed.length ? randomUUID() : undefined;
  const canonicalHash = proposed.length ? canonicalPlanHash(proposed as ProposedAction[]) : undefined;

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
    if (proposed.length && planId && canonicalHash) {
      await tx.insert(actionPlans).values({ id: planId, userId, conversationId: currentId, version: 1, status: "awaiting_approval", canonicalHash, expiresAt: new Date(Date.now() + 15 * 60_000) });
      await tx.insert(actions).values(proposed.map((action, sequenceNo) => ({ id: randomUUID(), planId, userId, type: action.tool, argumentsJson: action.args, status: "pending" as const, executionKey: randomUUID(), sequenceNo })));
    }
    return currentId;
  });

  return {
    conversationId,
    assistantText,
    resultType: missingDetails.length || missingTask.length || missingPreferences || missingRecipient ? "needs_clarification" : proposal.kind,
    questions: missingDetails.length || missingTask.length || missingPreferences || missingRecipient ? [assistantText] : proposal.questions,
    plan: proposed.length && planId && canonicalHash ? { id: planId, version: 1, canonicalHash, actions: proposed } : null,
  };
}
