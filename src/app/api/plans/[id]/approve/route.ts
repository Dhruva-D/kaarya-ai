import { auth } from "@/auth";
import { approvalInputSchema, canonicalActionHash, validateCalendarProposal } from "@/lib/agent/plan";
import { calendarActionSchema } from "@/lib/agent/proposal";
import { recordCalendarOutcome } from "@/lib/db/repositories/action-outcome";
import { claimCalendarPlan } from "@/lib/db/repositories/plans";
import { CalendarWriteError, createCalendarEvent } from "@/lib/integrations/google/calendar";
import { CalendarConnectionUnavailable, getCalendarAuth } from "@/lib/integrations/google/connection";
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

  let googleAuth;
  try {
    googleAuth = await getCalendarAuth(session.user.id);
  } catch (error) {
    if (error instanceof CalendarConnectionUnavailable) return Response.json({ code: "GOOGLE_RECONNECT", message: error.message }, { status: 403 });
    return Response.json({ code: "CALENDAR_UNAVAILABLE", message: "Google connection could not be checked" }, { status: 503 });
  }
  let claimed;
  try {
    claimed = await claimCalendarPlan(id, session.user.id, parsed.data);
  } catch {
    return Response.json({ code: "APPROVAL_UNAVAILABLE", message: "Approval could not be recorded" }, { status: 503 });
  }
  if (!claimed) return Response.json({ code: "STALE_PLAN", message: "This plan is expired, changed, or already approved" }, { status: 409 });

  const checked = calendarActionSchema.safeParse({ tool: claimed.action.type, args: claimed.action.argumentsJson });
  if (!checked.success || canonicalActionHash(checked.data) !== claimed.plan.canonicalHash) {
    await recordCalendarOutcome(session.user.id, id, claimed.action.id, { status: "failed", errorCode: "INVALID_STORED_ACTION" }).catch(() => undefined);
    return Response.json({ code: "INVALID_PLAN", message: "Stored action did not match the approved preview" }, { status: 409 });
  }
  try {
    validateCalendarProposal(checked.data, checked.data.args.timezone);
  } catch {
    await recordCalendarOutcome(session.user.id, id, claimed.action.id, { status: "failed", errorCode: "EVENT_TIME_INVALID" }).catch(() => undefined);
    return Response.json({ code: "EVENT_TIME_INVALID", message: "This event time is no longer valid" }, { status: 409 });
  }

  try {
    const receipt = await createCalendarEvent(claimed.action.id, checked.data, googleAuth);
    await recordCalendarOutcome(session.user.id, id, claimed.action.id, { status: "succeeded", ...receipt });
    return Response.json({ status: "succeeded", actionId: claimed.action.id, provider: "google_calendar", ...receipt });
  } catch (error) {
    const status = error instanceof CalendarWriteError ? error.outcome : "unknown";
    const saved = await recordCalendarOutcome(session.user.id, id, claimed.action.id, { status, errorCode: status === "failed" ? "GOOGLE_REJECTED" : "CONFIRMATION_LOST" })
      .then(() => true).catch(() => false);
    const visibleStatus = saved ? status : "unknown";
    return Response.json({ status: visibleStatus, actionId: claimed.action.id, message: visibleStatus === "unknown" ? "Calendar may have created this event. Check Calendar before trying again." : "Calendar could not create this event." }, { status: visibleStatus === "unknown" ? 202 : 502 });
  }
}
