import { z } from "zod";

export const speechLanguageSchema = z.enum(["bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "ta-IN", "te-IN"]);
export type SpeechLanguage = z.infer<typeof speechLanguageSchema>;

const voices: Record<SpeechLanguage, string> = {
  "bn-IN": "Kirra", "en-IN": "Kaveri", "gu-IN": "Falak", "hi-IN": "Nalini", "kn-IN": "Saanvi",
  "ml-IN": "Reshma", "mr-IN": "Zahira", "pa-IN": "Mehuli", "ta-IN": "Trisha", "te-IN": "Suhana",
};

export class GnaniSynthesisError extends Error {
  constructor(public readonly code: "NETWORK" | "PROVIDER_HTTP" | "INVALID_AUDIO", public readonly providerStatus?: number) {
    super(`Gnani synthesis ${code.toLowerCase()}`);
  }
}

export async function synthesizeSpeech(
  text: string,
  language: SpeechLanguage,
  options: { apiKey: string; endpoint?: string; fetchImpl?: typeof fetch },
): Promise<Uint8Array> {
  if (!text.trim() || text.length > 500 || !options.apiKey.trim()) throw new Error("Invalid synthesis input");
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(options.endpoint ?? "https://api.vachana.ai/api/v1/tts/inference", {
      method: "POST",
      headers: { "X-API-Key-ID": options.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text, voice: voices[language], model: "timbre-v2.5", language, speed: 1,
        audio_config: { sample_rate: 48000, num_channels: 1, sample_width: 2, encoding: "linear_pcm", container: "wav" },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new GnaniSynthesisError("NETWORK");
  }
  if (!response.ok) throw new GnaniSynthesisError("PROVIDER_HTTP", response.status);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("audio/wav") && !contentType.includes("audio/x-wav") && !contentType.includes("application/octet-stream")) {
    throw new GnaniSynthesisError("INVALID_AUDIO");
  }
  const size = Number(response.headers.get("content-length") ?? 0);
  if (size > 8_000_000) throw new GnaniSynthesisError("INVALID_AUDIO");
  const audio = new Uint8Array(await response.arrayBuffer());
  if (audio.length < 44 || audio.length > 8_000_000 || new TextDecoder().decode(audio.subarray(0, 4)) !== "RIFF" ||
      new TextDecoder().decode(audio.subarray(8, 12)) !== "WAVE") throw new GnaniSynthesisError("INVALID_AUDIO");
  return audio;
}
