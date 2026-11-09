import { Buffer } from "node:buffer";
import { auth } from "@/auth";
import { transcribeWav } from "@/lib/integrations/gnani/stt";
import { isSameOriginPost } from "@/lib/security/origin";
import { claimProviderBudget } from "@/lib/security/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";

const languageSchema = z.enum(["hi-IN", "en-IN"]);

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return Response.json({ code: "BAD_ORIGIN", message: "Request origin was rejected" }, { status: 403 });
  if (!process.env.GNANI_API_KEY) return Response.json({ code: "NOT_CONFIGURED", message: "Voice transcription is not connected yet" }, { status: 503 });
  const session = await auth();
  if (!session?.user?.id) return Response.json({ code: "UNAUTHENTICATED", message: "Sign in to continue" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 3_200_000) {
    return Response.json({ code: "AUDIO_TOO_LARGE", message: "Keep recordings under 30 seconds" }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const language = languageSchema.safeParse(form?.get("languageCode"));
  if (!(audio instanceof File) || audio.size > 3_000_000 || audio.size < 44 || !language.success) {
    return Response.json({ code: "INVALID_AUDIO", message: "Use a short WAV recording in Hindi or English" }, { status: 400 });
  }
  try {
    if (!await claimProviderBudget(session.user.id, "gnani_stt")) return Response.json({ code: "RATE_LIMITED", message: "Please wait before making another voice request" }, { status: 429 });
    const result = await transcribeWav(Buffer.from(await audio.arrayBuffer()), {
      apiKey: process.env.GNANI_API_KEY,
      languageCode: language.data,
      endpoint: process.env.GNANI_STT_URL,
    });
    return Response.json({ provider: "gnani", ...result });
  } catch {
    return Response.json({ code: "TRANSCRIPTION_FAILED", message: "Gnani could not transcribe this clip. You can retry or type instead." }, { status: 502 });
  }
}
