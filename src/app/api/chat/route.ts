import { auth } from "@/auth";
import { chatRequestSchema } from "@/lib/agent/chat-request";
import { ConversationNotFound, handleChat, UnsafeProposal } from "@/lib/agent/chat-service";
import { GeminiProposalError } from "@/lib/integrations/gemini/planner";
import { isSameOriginPost } from "@/lib/security/origin";
import { claimProviderBudget } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return Response.json({ code: "BAD_ORIGIN", message: "Request origin was rejected" }, { status: 403 });
  if (!process.env.GEMINI_API_KEY || !process.env.DATABASE_URL) return Response.json({ code: "NOT_CONFIGURED", message: "Chat is not configured yet" }, { status: 503 });
  const session = await auth();
  if (!session?.user?.id) return Response.json({ code: "UNAUTHENTICATED", message: "Sign in to continue" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 10_000) return Response.json({ code: "INVALID_INPUT", message: "Message is too large" }, { status: 413 });
  const parsed = chatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ code: "INVALID_INPUT", message: "Please check your message" }, { status: 400 });
  try {
    if (!await claimProviderBudget(session.user.id, "chat")) return Response.json({ code: "RATE_LIMITED", message: "Please wait a few minutes before sending more requests" }, { status: 429 });
    return Response.json(await handleChat(session.user.id, parsed.data));
  } catch (error) {
    if (error instanceof ConversationNotFound) return Response.json({ code: "NOT_FOUND", message: "Conversation not found" }, { status: 404 });
    if (error instanceof UnsafeProposal) return Response.json({ code: "NEEDS_CLARIFICATION", message: error.message }, { status: 422 });
    if ((error as { code?: string })?.code === "23505") return Response.json({ code: "DUPLICATE_REQUEST", message: "This message was already submitted" }, { status: 409 });
    if (error instanceof GeminiProposalError) {
      console.warn("Gemini proposal failed", { reason: error.reason });
      const responses = {
        busy: { status: 503, code: "GEMINI_BUSY", message: "Gemini is temporarily busy. Your message is still here; please try Send again in a moment." },
        rate_limited: { status: 429, code: "GEMINI_RATE_LIMITED", message: "Gemini has reached its current request limit. Your message is still here. Try again later, or check usage in Google AI Studio." },
        configuration: { status: 503, code: "GEMINI_CONFIGURATION", message: "The AI connection needs attention. Please check the server configuration." },
        invalid_response: { status: 502, code: "GEMINI_INVALID_RESPONSE", message: "Gemini returned an unusable plan. Your message is still here; please try again." },
        unavailable: { status: 503, code: "GEMINI_UNAVAILABLE", message: "Gemini could not be reached. Your message is still here; please try again." },
      } as const;
      const response = responses[error.reason];
      return Response.json({ code: response.code, message: response.message }, { status: response.status });
    }
    console.error("Chat request failed outside Gemini", { errorType: error instanceof Error ? error.name : "unknown" });
    return Response.json({ code: "CHAT_STORAGE_UNAVAILABLE", message: "Your conversation could not be saved right now. Your message is still here; please try again." }, { status: 503 });
  }
}
