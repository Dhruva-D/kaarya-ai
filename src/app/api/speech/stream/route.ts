import { auth } from "@/auth";
import { speechLanguageSchema } from "@/lib/integrations/gnani/tts";
import { isSameOriginPost } from "@/lib/security/origin";
import { claimProviderBudget } from "@/lib/security/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";
const schema = z.strictObject({ text: z.string().trim().min(1).max(500), language: speechLanguageSchema });
export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return Response.json({ message: "Request origin was rejected" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "Sign in to continue" }, { status: 401 });
  if (!process.env.GNANI_API_KEY) return Response.json({ message: "Gnani speech is not configured" }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > 4000) return Response.json({ message: "Speech request is too large" }, { status: 413 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Invalid voice reply" }, { status: 400 });
  if (!await claimProviderBudget(session.user.id, "gnani_tts")) return Response.json({ message: "Voice request limit reached. Please pause before continuing." }, { status: 429 });
  try {
    const response = await fetch("https://api.vachana.ai/api/v1/tts/sse", { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key-ID": process.env.GNANI_API_KEY }, body: JSON.stringify({ ...parsed.data, model: "timbre-v3.0", voice: "Shivani", speed: 1, audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: "linear_pcm", container: "raw" } }), signal: AbortSignal.any([request.signal, AbortSignal.timeout(30000)]) });
    if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
      await response.body?.cancel();
      return Response.json({ message: "Gnani streaming speech is unavailable. Your reply remains in chat." }, { status: 502 });
    }
    return new Response(response.body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no", "X-Content-Type-Options": "nosniff" } });
  } catch { return Response.json({ message: "Gnani streaming speech could not be reached" }, { status: 502 }); }
}
