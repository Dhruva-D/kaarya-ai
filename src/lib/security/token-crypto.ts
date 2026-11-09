import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function parseTokenKey(base64: string | undefined): Buffer {
  const key = Buffer.from(base64 ?? "", "base64");
  if (!base64 || key.byteLength !== 32 || key.toString("base64") !== base64) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

export function encryptToken(token: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptToken(value: string, key: Buffer): string {
  const [version, iv, tag, data, extra] = value.split(":");
  if (version !== "v1" || !iv || !tag || !data || extra !== undefined) throw new Error("Invalid encrypted token");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Encrypted token could not be authenticated");
  }
}
