import { describe, expect, it } from "vitest";
import { chatRequestSchema } from "./chat-request";

describe("chat request", () => {
  it("accepts bounded typed input and rejects forged server fields", () => {
    const valid = { text: "Kal 5 baje meeting", inputMode: "text", clientRequestId: "11111111-1111-4111-8111-111111111111" };
    expect(chatRequestSchema.safeParse(valid).success).toBe(true);
    expect(chatRequestSchema.safeParse({ ...valid, userId: "another-user" }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...valid, text: "x".repeat(2_001) }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...valid, inputMode: "voice", languageCode: "kn-IN" }).success).toBe(true);
    expect(chatRequestSchema.safeParse({ ...valid, inputMode: "voice", languageCode: "auto" }).success).toBe(false);
  });
});
