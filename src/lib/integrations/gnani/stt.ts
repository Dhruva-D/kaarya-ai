import { Buffer } from "node:buffer";
import { z } from "zod";
import { validateWav } from "./wav";

const responseSchema = z.object({
  success: z.literal(true),
  transcript: z.string().trim().min(1),
  model: z.literal("prisma-v2.5"),
  request_id: z.string().max(128).optional(),
});

export type Transcription = {
  transcript: string;
  model: "prisma-v2.5";
  requestId?: string;
};

export async function transcribeWav(
  audio: Buffer,
  options: {
    apiKey: string;
    languageCode: "hi-IN" | "en-IN";
    endpoint?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<Transcription> {
  validateWav(audio);
  if (!options.apiKey.trim()) throw new Error("Gnani API key is missing");

  const form = new FormData();
  form.append("audio_file", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "speech.wav");
  form.append("language_code", options.languageCode);

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
    throw new Error("Gnani transcription request failed or timed out");
  }
  if (!response.ok) {
    throw new Error(`Gnani transcription failed (HTTP ${response.status})`);
  }
  const data = responseSchema.safeParse(await response.json().catch(() => null));
  if (!data.success) throw new Error("Gnani returned an invalid or unsupported transcription response");
  return {
    transcript: data.data.transcript,
    model: data.data.model,
    requestId: data.data.request_id,
  };
}
