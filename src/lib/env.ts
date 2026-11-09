import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

export const serverEnvSchema = z.object({
  AUTH_SECRET: nonEmpty,
  AUTH_GOOGLE_ID: nonEmpty,
  AUTH_GOOGLE_SECRET: nonEmpty,
  DATABASE_URL: z.url().refine((url) => url.startsWith("postgresql://") || url.startsWith("postgres://")),
  TOKEN_ENCRYPTION_KEY: nonEmpty,
  GNANI_API_KEY: nonEmpty,
  GEMINI_API_KEY: nonEmpty,
  GEMINI_MODEL: nonEmpty.default("gemini-3.6-flash"),
  GNANI_STT_URL: z.url().default("https://api.vachana.ai/stt/v3"),
  GNANI_TTS_URL: z.url().default("https://api.vachana.ai/api/v1/tts/inference"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(values: Record<string, unknown>): ServerEnv {
  const result = serverEnvSchema.safeParse(values);
  if (!result.success) {
    const invalid = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Server configuration is incomplete or invalid: ${invalid}`);
  }
  return result.data;
}
