import { auth } from "@/auth";
import { approvalInputSchema, canonicalPlanHash, validateCalendarProposal, type ProposedAction } from "@/lib/agent/plan";
import { proposedActionSchema } from "@/lib/agent/proposal";
import { validateTaskProposal } from "@/lib/agent/task-plan";
import { recordActionOutcome } from "@/lib/db/repositories/action-outcome";
import { claimActionPlan, getOwnedPendingActionTypes } from "@/lib/db/repositories/plans";
import { CalendarWriteError, createCalendarEvent } from "@/lib/integrations/google/calendar";
import { CalendarConnectionUnavailable, getCalendarAuth, getTasksAuth, getGmailAuth } from "@/lib/integrations/google/connection";
import { createGoogleTask, TaskWriteError } from "@/lib/integrations/google/tasks";
import { sendGmailMessage, GmailWriteError } from "@/lib/integrations/google/gmail";
import { isSameOriginPost } from "@/lib/security/origin";
import { z } from "zod";

export const runtime = "nodejs";

type Tool = ProposedAction["tool"];
type GoogleAuth = Awaited<ReturnType<typeof getCalendarAuth>>;
const supported = new Set<Tool>(["calendar.create_event", "tasks.create_task", "gmail.send"]);
const providerFor = (tool: Tool) => tool === "tasks.create_task" ? "google_tasks" as const
  : tool === "gmail.send" ? "gmail" as const : "google_calendar" as const;

async function connectionFor(tool: Tool, userId: string): Promise<GoogleAuth> {
  return tool === "tasks.create_task" ? getTasksAuth(userId)
    : tool === "gmail.send" ? getGmailAuth(userId) : getCalendarAuth(userId);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginPost(request)) return Response.json({ code: "BAD_ORIGIN", message: "Request origin was rejected" }, { status: 403 });
  if (!process.env.DATABASE_URL) return Response.json({ code: "NOT_CONFIGURED", message: "Google actions are not configured yet" }, { status: 503 });
  const session = await auth();
  if (!session?.user?.id) return Response.json({ code: "UNAUTHENTICATED", message: "Sign in to continue" }, { status: 401 });
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ code: "INVALID_INPUT", message: "Invalid plan" }, { status: 400 });
  const parsed = approvalInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ code: "INVALID_INPUT", message: "Please review and confirm the current plan" }, { status: 400 });

  const types = await getOwnedPendingActionTypes(id, session.user.id).catch(() => []);
  if (!types.length || types.length > 2 || types.some((type) => !supported.has(type as Tool))) {
    return Response.json({ code: "STALE_PLAN", message: "This plan is expired, changed, or already approved" }, { status: 409 });
  }
  if (types.some((type) => type === "gmail.send") && !session.user.email) {
    return Response.json({ code: "GOOGLE_ACCOUNT_UNKNOWN", message: "The sending Google account could not be confirmed. Sign in again before sending email." }, { status: 403 });
  }
  const authByType = new Map<Tool, GoogleAuth>();
  try {
    for (const type of types) {
      const tool = type as Tool;
      if (!authByType.has(tool)) authByType.set(tool, await connectionFor(tool, session.user.id));
    }
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

  const checked = claimed.actions.map((row) => proposedActionSchema.safeParse({ tool: row.type, args: row.argumentsJson }));
  const valid = checked.every((item) => item.success);
  const proposed = valid ? checked.map((item) => item.data!) : [];
  const matching = valid && proposed.length === types.length && proposed.every((item, index) => item.tool === types[index])
    && canonicalPlanHash(proposed) === claimed.plan.canonicalHash;
  let semanticallyValid = matching;
  if (matching) {
    try {
      for (const action of proposed) {
        if (action.tool === "calendar.create_event") validateCalendarProposal(action, action.args.timezone);
        else if (action.tool === "tasks.create_task") validateTaskProposal(action);
      }
    } catch { semanticallyValid = false; }
  }
  if (!semanticallyValid) {
    for (const row of claimed.actions) {
      await recordActionOutcome(session.user.id, id, row.id, providerFor(row.type as Tool), { status: "failed", errorCode: "INVALID_STORED_ACTION" }).catch(() => undefined);
    }
    return Response.json({ code: "INVALID_PLAN", message: "Stored actions did not match the approved preview" }, { status: 409 });
  }

  const results: Array<{ actionId: string; status: "succeeded" | "failed" | "unknown"; provider: string }> = [];
  for (let index = 0; index < claimed.actions.length; index++) {
    const row = claimed.actions[index];
    const action = proposed[index];
    const provider = providerFor(action.tool);
    const googleAuth = authByType.get(action.tool)!;
    try {
      const receipt = action.tool === "calendar.create_event" ? await createCalendarEvent(row.id, action, googleAuth)
        : action.tool === "tasks.create_task" ? await createGoogleTask(action, googleAuth)
          : await sendGmailMessage(action, googleAuth);
      await recordActionOutcome(session.user.id, id, row.id, provider, { status: "succeeded", ...receipt });
      results.push({ actionId: row.id, status: "succeeded", provider });
    } catch (error) {
      const status = error instanceof CalendarWriteError || error instanceof TaskWriteError || error instanceof GmailWriteError ? error.outcome : "unknown";
      const saved = await recordActionOutcome(session.user.id, id, row.id, provider, { status, errorCode: status === "failed" ? "GOOGLE_REJECTED" : "CONFIRMATION_LOST" })
        .then(() => true).catch(() => false);
      if (!saved) return Response.json({ status: "unknown", message: "An action may have completed, but its receipt could not be saved. Check the connected Google apps before any new request." }, { status: 202 });
      results.push({ actionId: row.id, status, provider });
    }
  }
  const status = results.some((item) => item.status === "unknown") ? "unknown"
    : results.some((item) => item.status === "failed") ? results.some((item) => item.status === "succeeded") ? "partial" : "failed" : "succeeded";
  return Response.json({ status, results }, { status: status === "unknown" ? 202 : status === "partial" ? 207 : status === "failed" ? 502 : 200 });
}
