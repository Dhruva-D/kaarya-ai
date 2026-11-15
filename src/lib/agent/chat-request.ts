import { z } from "zod";
import { speechLanguageSchema } from "@/lib/integrations/gnani/tts";

export const chatRequestSchema = z.strictObject({
  conversationId: z.uuid().optional(),
  text: z.string().trim().min(1).max(2_000),
  inputMode: z.enum(["text", "voice"]),
  languageCode: speechLanguageSchema.optional(),
  clientRequestId: z.uuid(),
  reasoningModel: z.enum(["codex-gpt-6-luna", "gemini-3.5-flash-lite", "gemini-3.6-flash"]).default("codex-gpt-6-luna"),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
