import { auth } from "@/auth";
import { chatRequestSchema } from "@/lib/agent/chat-request";
import { ConversationNotFound, handleChat, UnsafeProposal } from "@/lib/agent/chat-service";
import { isSameOriginPost } from "@/lib/security/origin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return Response.json({ code: "BAD_ORIGIN", message: "Request origin was rejected" }, { status: 403 });
  if (!process.env.GEMINI_API_KEY || !process.env.DATABASE_URL) return Response.json({ code: "NOT_CONFIGURED", message: "Chat is not configured yet" }, { status: 503 });
  const session = await auth();
  if (!session?.user?.id) return Response.json({ code: "UNAUTHENTICATED", message: "Sign in to continue" }, { status: 401 });
  const parsed = chatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ code: "INVALID_INPUT", message: "Please check your message" }, { status: 400 });
  try {
    return Response.json(await handleChat(session.user.id, parsed.data));
  } catch (error) {
    if (error instanceof ConversationNotFound) return Response.json({ code: "NOT_FOUND", message: "Conversation not found" }, { status: 404 });
    if (error instanceof UnsafeProposal) return Response.json({ code: "NEEDS_CLARIFICATION", message: error.message }, { status: 422 });
    if ((error as { code?: string })?.code === "23505") return Response.json({ code: "DUPLICATE_REQUEST", message: "This message was already submitted" }, { status: 409 });
    return Response.json({ code: "CHAT_UNAVAILABLE", message: "The assistant could not prepare a safe response. Please retry." }, { status: 503 });
  }
}
