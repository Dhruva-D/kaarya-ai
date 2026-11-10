import { Buffer } from "node:buffer";
import { z } from "zod";
import { validateWav } from "./wav";

const responseSchema = z.object({
  success: z.literal(true),
  transcript: z.string().trim().min(1),
  model: z.literal("prisma-v3.0"),
  detected_language_code: z.enum(["bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "ta-IN", "te-IN"]),
  request_id: z.string().max(128).optional(),
});

export class GnaniTranscriptionError extends Error {
  constructor(
    public readonly code: "NETWORK" | "PROVIDER_HTTP" | "NO_SPEECH" | "INVALID_RESPONSE",
    message: string,
    public readonly providerStatus?: number,
  ) {
    super(message);
  }
}

export type Transcription = {
  transcript: string;
  model: "prisma-v3.0";
  detectedLanguageCode: z.infer<typeof responseSchema>["detected_language_code"];
  requestId?: string;
};

export async function transcribeWav(
  audio: Buffer,
  options: {
    apiKey: string;
    endpoint?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<Transcription> {
  validateWav(audio);
  if (!options.apiKey.trim()) throw new Error("Gnani API key is missing");

  const form = new FormData();
  form.append("audio_file", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "speech.wav");
  form.append("model", "prisma-v3.0");
  form.append("language_code", "indic-auto");

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(
      options.endpoint ?? "https://api.vachana.ai/stt/v3",
      {
        method: "POST",
        headers: { "X-API-Key-ID": options.apiKey },
        body: form,
        signal: AbortSignal.timeout(45_000),
      },
    );
  } catch {
    throw new GnaniTranscriptionError("NETWORK", "Gnani transcription request failed or timed out");
  }
  if (!response.ok) {
    throw new GnaniTranscriptionError("PROVIDER_HTTP", `Gnani transcription failed (HTTP ${response.status})`, response.status);
  }
  const payload = await response.json().catch(() => null);
  if (payload && typeof payload === "object" && "transcript" in payload &&
      typeof payload.transcript === "string" && !payload.transcript.trim()) {
    throw new GnaniTranscriptionError("NO_SPEECH", "Gnani did not detect speech in this clip");
  }
  const data = responseSchema.safeParse(payload);
  if (!data.success) throw new GnaniTranscriptionError("INVALID_RESPONSE", "Gnani returned an invalid or unsupported transcription response");
  return {
    transcript: data.data.transcript,
    model: data.data.model,
    detectedLanguageCode: data.data.detected_language_code,
    requestId: data.data.request_id,
  };
}
