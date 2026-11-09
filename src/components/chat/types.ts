export type ConversationSummary = { id: string; title: string; updatedAt: string };
export type Turn = { id: string; role: "user" | "assistant"; content: string; createdAt: string };
export type CalendarPlan = {
  id: string;
  version: number;
  status: "awaiting_approval" | "executing" | "succeeded" | "failed" | "unknown" | "rejected" | "superseded" | "expired" | "draft" | "needs_details";
  canonicalHash: string;
  action: { tool: "calendar.create_event"; args: { title: string; startIso: string; endIso: string; timezone: string } };
  receipt: { status: string; providerObjectId?: string | null; providerLink?: string | null; errorCode?: string | null };
};
export type CalendarHistoryItem = {
  planId: string;
  status: "succeeded" | "failed" | "unknown";
  title: string;
  startIso: string;
  timezone: string;
  providerObjectId: string | null;
  providerLink: string | null;
};
export type ConversationDetail = { id: string; title: string; messages: Turn[]; plan: CalendarPlan | null; history: CalendarHistoryItem[] };

export async function readApiError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return typeof body?.message === "string" ? body.message : "The request could not be completed.";
}
