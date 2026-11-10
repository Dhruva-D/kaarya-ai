export type ConversationSummary = { id: string; title: string; updatedAt: string };
export type Turn = { id: string; role: "user" | "assistant"; content: string; languageCode: string | null; createdAt: string };
type PlanBase = {
  id: string;
  version: number;
  status: "awaiting_approval" | "executing" | "succeeded" | "failed" | "unknown" | "rejected" | "superseded" | "expired" | "draft" | "needs_details";
  expiresAt: string;
  canonicalHash: string;
  receipt: { status: string; providerObjectId?: string | null; providerLink?: string | null; meetStatus?: "confirmed" | "pending" | "failed" | null; meetLink?: string | null; errorCode?: string | null };
};
export type CalendarPlan = PlanBase & {
  action: { tool: "calendar.create_event"; args: { title: string; startIso: string; endIso: string; timezone: string; attendees?: string[]; addMeet?: boolean } };
};
export type TaskPlan = PlanBase & {
  action: { tool: "tasks.create_task"; args: { title: string; notes?: string; dueDate?: string } };
};
export type ActionPlan = CalendarPlan | TaskPlan;
export type CalendarHistoryItem = {
  tool: "calendar.create_event";
  planId: string;
  status: "succeeded" | "failed" | "unknown";
  title: string;
  startIso: string;
  timezone: string;
  providerObjectId: string | null;
  providerLink: string | null;
};
export type TaskHistoryItem = { planId: string; status: "succeeded" | "failed" | "unknown"; title: string; dueDate?: string; providerObjectId: string | null; providerLink: string | null; tool: "tasks.create_task" };
export type ActionHistoryItem = CalendarHistoryItem | TaskHistoryItem;
export type ConversationDetail = { id: string; title: string; messages: Turn[]; plan: ActionPlan | null; history: ActionHistoryItem[] };

export async function readApiError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return typeof body?.message === "string" ? body.message : "The request could not be completed.";
}
