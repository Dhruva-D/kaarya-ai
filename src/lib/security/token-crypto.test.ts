import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken, parseTokenKey } from "./token-crypto";

describe("Google token encryption", () => {
  it("round trips with a fresh IV and never embeds plaintext", () => {
    const key = parseTokenKey(randomBytes(32).toString("base64"));
    const first = encryptToken("test-refresh-token", key);
    const second = encryptToken("test-refresh-token", key);
    expect(first).not.toBe(second);
    expect(first).not.toContain("test-refresh-token");
    expect(decryptToken(first, key)).toBe("test-refresh-token");
  });

  it("rejects malformed keys and tampered ciphertext", () => {
    expect(() => parseTokenKey("too-short")).toThrow(/32-byte/);
    const key = randomBytes(32);
    const encrypted = encryptToken("test-token", key);
    expect(() => decryptToken(encrypted, randomBytes(32))).toThrow(/authenticated/);
    expect(() => decryptToken(encrypted + ":extra", key)).toThrow(/Invalid/);
  });
});
