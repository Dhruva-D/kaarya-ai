import { auth } from "@/auth";
import { synthesizeSpeech, GnaniSynthesisError, speechLanguageSchema } from "@/lib/integrations/gnani/tts";
import { isSameOriginPost } from "@/lib/security/origin";
import { claimProviderBudget } from "@/lib/security/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";

const requestSchema = z.strictObject({ text: z.string().trim().min(1).max(500), language: speechLanguageSchema });

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return Response.json({ code: "BAD_ORIGIN", message: "Request origin was rejected" }, { status: 403 });
  if (!process.env.GNANI_API_KEY) return Response.json({ code: "NOT_CONFIGURED", message: "Voice reply is not connected yet" }, { status: 503 });
  const session = await auth();
  if (!session?.user?.id) return Response.json({ code: "UNAUTHENTICATED", message: "Sign in to continue" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 2_000) return Response.json({ code: "INVALID_INPUT", message: "Voice reply is too long" }, { status: 413 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ code: "INVALID_INPUT", message: "Voice reply text or language is invalid" }, { status: 400 });
  try {
    if (!await claimProviderBudget(session.user.id, "gnani_tts")) return Response.json({ code: "RATE_LIMITED", message: "Please wait before another voice reply" }, { status: 429 });
    const audio = await synthesizeSpeech(parsed.data.text, parsed.data.language, { apiKey: process.env.GNANI_API_KEY, endpoint: process.env.GNANI_TTS_URL });
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof GnaniSynthesisError) console.warn("Gnani TTS failed", { code: error.code, providerStatus: error.providerStatus });
    return Response.json({ code: "GNANI_UNAVAILABLE", message: "Gnani could not speak this reply right now. You can read the text above." }, { status: 502 });
  }
}
