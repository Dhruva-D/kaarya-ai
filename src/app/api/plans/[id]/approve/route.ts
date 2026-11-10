import { auth } from "@/auth";
import { approvalInputSchema, canonicalActionHash, validateCalendarProposal } from "@/lib/agent/plan";
import { proposedActionSchema } from "@/lib/agent/proposal";
import { validateTaskProposal } from "@/lib/agent/task-plan";
import { recordActionOutcome } from "@/lib/db/repositories/action-outcome";
import { claimActionPlan, getOwnedPendingActionType } from "@/lib/db/repositories/plans";
import { CalendarWriteError, createCalendarEvent } from "@/lib/integrations/google/calendar";
import { CalendarConnectionUnavailable, getCalendarAuth, getTasksAuth } from "@/lib/integrations/google/connection";
import { createGoogleTask, TaskWriteError } from "@/lib/integrations/google/tasks";
import { isSameOriginPost } from "@/lib/security/origin";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginPost(request)) return Response.json({ code: "BAD_ORIGIN", message: "Request origin was rejected" }, { status: 403 });
  if (!process.env.DATABASE_URL) return Response.json({ code: "NOT_CONFIGURED", message: "Calendar is not configured yet" }, { status: 503 });
  const session = await auth();
  if (!session?.user?.id) return Response.json({ code: "UNAUTHENTICATED", message: "Sign in to continue" }, { status: 401 });
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ code: "INVALID_INPUT", message: "Invalid plan" }, { status: 400 });
  const parsed = approvalInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ code: "INVALID_INPUT", message: "Please review and confirm the current plan" }, { status: 400 });

  const actionType = await getOwnedPendingActionType(id, session.user.id).catch(() => null);
  if (actionType !== "calendar.create_event" && actionType !== "tasks.create_task") {
    return Response.json({ code: "STALE_PLAN", message: "This plan is expired, changed, or already approved" }, { status: 409 });
  }
  const provider = actionType === "tasks.create_task" ? "google_tasks" : "google_calendar";
  let googleAuth;
  try {
    googleAuth = actionType === "tasks.create_task" ? await getTasksAuth(session.user.id) : await getCalendarAuth(session.user.id);
  } catch (error) {
    if (error instanceof CalendarConnectionUnavailable) return Response.json({ code: "GOOGLE_RECONNECT", message: error.message }, { status: 403 });
    return Response.json({ code: "GOOGLE_UNAVAILABLE", message: "Google connection could not be checked" }, { status: 503 });
  }
  let claimed;
  try {
    claimed = await claimActionPlan(id, session.user.id, parsed.data);
  } catch {
    return Response.json({ code: "APPROVAL_UNAVAILABLE", message: "Approval could not be recorded" }, { status: 503 });
  }
  if (!claimed) return Response.json({ code: "STALE_PLAN", message: "This plan is expired, changed, or already approved" }, { status: 409 });

  const checked = proposedActionSchema.safeParse({ tool: claimed.action.type, args: claimed.action.argumentsJson });
  if (!checked.success || checked.data.tool !== actionType || canonicalActionHash(checked.data) !== claimed.plan.canonicalHash) {
    await recordActionOutcome(session.user.id, id, claimed.action.id, provider, { status: "failed", errorCode: "INVALID_STORED_ACTION" }).catch(() => undefined);
    return Response.json({ code: "INVALID_PLAN", message: "Stored action did not match the approved preview" }, { status: 409 });
  }
  try {
    if (checked.data.tool === "calendar.create_event") validateCalendarProposal(checked.data, checked.data.args.timezone);
    else validateTaskProposal(checked.data);
  } catch {
    await recordActionOutcome(session.user.id, id, claimed.action.id, provider, { status: "failed", errorCode: "ACTION_INVALID" }).catch(() => undefined);
    return Response.json({ code: "ACTION_INVALID", message: "This action is no longer valid" }, { status: 409 });
  }

  try {
    const receipt = checked.data.tool === "calendar.create_event"
      ? await createCalendarEvent(claimed.action.id, checked.data, googleAuth)
      : await createGoogleTask(checked.data, googleAuth);
    await recordActionOutcome(session.user.id, id, claimed.action.id, provider, { status: "succeeded", ...receipt });
    return Response.json({ status: "succeeded", actionId: claimed.action.id, provider, ...receipt });
  } catch (error) {
    const status = error instanceof CalendarWriteError || error instanceof TaskWriteError ? error.outcome : "unknown";
    const saved = await recordActionOutcome(session.user.id, id, claimed.action.id, provider, { status, errorCode: status === "failed" ? "GOOGLE_REJECTED" : "CONFIRMATION_LOST" })
      .then(() => true).catch(() => false);
    const visibleStatus = saved ? status : "unknown";
    const label = provider === "google_tasks" ? "Google Tasks" : "Calendar";
    return Response.json({ status: visibleStatus, actionId: claimed.action.id, message: visibleStatus === "unknown" ? `${label} may have created this action. Check ${label} before trying again.` : `${label} could not create this action.` }, { status: visibleStatus === "unknown" ? 202 : 502 });
  }
}
