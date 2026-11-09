import { auth } from "@/auth";
import { getOwnedConversation } from "@/lib/db/repositories/conversations";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return Response.json({ code: "NOT_CONFIGURED", message: "History is not configured yet" }, { status: 503 });
  const session = await auth();
  if (!session?.user?.id) return Response.json({ code: "UNAUTHENTICATED", message: "Sign in to continue" }, { status: 401 });
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ code: "INVALID_INPUT", message: "Invalid conversation" }, { status: 400 });
  try {
    const conversation = await getOwnedConversation(session.user.id, id);
    if (!conversation) return Response.json({ code: "NOT_FOUND", message: "Conversation not found" }, { status: 404 });
    return Response.json(conversation);
  } catch {
    return Response.json({ code: "HISTORY_UNAVAILABLE", message: "Conversation could not be loaded" }, { status: 503 });
  }
}
