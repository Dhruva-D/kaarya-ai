import { auth } from "@/auth";
import { listOwnedConversations } from "@/lib/db/repositories/conversations";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.DATABASE_URL) return Response.json({ code: "NOT_CONFIGURED", message: "History is not configured yet" }, { status: 503 });
  const session = await auth();
  if (!session?.user?.id) return Response.json({ code: "UNAUTHENTICATED", message: "Sign in to continue" }, { status: 401 });
  try {
    return Response.json({ conversations: await listOwnedConversations(session.user.id) });
  } catch {
    return Response.json({ code: "HISTORY_UNAVAILABLE", message: "Conversations could not be loaded" }, { status: 503 });
  }
}
