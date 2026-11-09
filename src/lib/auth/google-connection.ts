import type { Account } from "next-auth";
import { getDb } from "../db/client";
import { googleConnections } from "../db/schema";
import { encryptToken, parseTokenKey } from "../security/token-crypto";

export async function saveGoogleConnection(userId: string, account: Account): Promise<void> {
  if (account.provider !== "google" || !account.access_token || !account.providerAccountId) {
    throw new Error("Google OAuth did not return a usable connection");
  }
  const key = parseTokenKey(process.env.TOKEN_ENCRYPTION_KEY);
  const accessTokenCiphertext = encryptToken(account.access_token, key);
  const refreshTokenCiphertext = account.refresh_token ? encryptToken(account.refresh_token, key) : undefined;
  const expiresAt = account.expires_at ? new Date(account.expires_at * 1_000) : null;
  await getDb().insert(googleConnections).values({
    userId,
    providerSubject: account.providerAccountId,
    scopes: account.scope ?? "",
    accessTokenCiphertext,
    refreshTokenCiphertext: refreshTokenCiphertext ?? null,
    expiresAt,
  }).onConflictDoUpdate({
    target: [googleConnections.userId, googleConnections.providerSubject],
    set: {
      scopes: account.scope ?? "",
      accessTokenCiphertext,
      ...(refreshTokenCiphertext ? { refreshTokenCiphertext } : {}),
      expiresAt,
      status: "connected",
      updatedAt: new Date(),
    },
  });
}
