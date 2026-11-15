import { z } from "zod";
import { speechLanguageSchema } from "@/lib/integrations/gnani/tts";

export const chatRequestSchema = z.strictObject({
  conversationId: z.uuid().optional(),
  text: z.string().trim().min(1).max(2_000),
  inputMode: z.enum(["text", "voice"]),
  languageCode: speechLanguageSchema.optional(),
  clientRequestId: z.uuid(),
  reasoningModel: z.literal("codex-gpt-5.6-luna").default("codex-gpt-5.6-luna"),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
