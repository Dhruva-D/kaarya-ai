import { auth } from "@/auth";
import { rejectOwnedPlan } from "@/lib/db/repositories/reject-plan";
import { isSameOriginPost } from "@/lib/security/origin";
import { z } from "zod";

export const runtime = "nodejs";

const inputSchema = z.strictObject({ planVersion: z.number().int().positive() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginPost(request)) return Response.json({ code: "BAD_ORIGIN", message: "Request origin was rejected" }, { status: 403 });
  if (!process.env.DATABASE_URL) return Response.json({ code: "NOT_CONFIGURED", message: "Plans are not configured yet" }, { status: 503 });
  const session = await auth();
  if (!session?.user?.id) return Response.json({ code: "UNAUTHENTICATED", message: "Sign in to continue" }, { status: 401 });
  const { id } = await context.params;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) return Response.json({ code: "INVALID_INPUT", message: "Invalid plan" }, { status: 400 });
  try {
    const rejected = await rejectOwnedPlan(session.user.id, id, parsed.data.planVersion);
    return rejected ? Response.json({ status: "rejected" }) : Response.json({ code: "STALE_PLAN", message: "This plan is no longer pending" }, { status: 409 });
  } catch {
    return Response.json({ code: "PLAN_UNAVAILABLE", message: "Plan could not be cancelled" }, { status: 503 });
  }
}
