import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { getDb } from "../db/client";
import { accounts, sessions, users, verificationTokens } from "../db/schema";

export function withoutOAuthTokens(account: AdapterAccount): AdapterAccount {
  return { ...account, access_token: undefined, refresh_token: undefined, id_token: undefined };
}

export function wrapTokenSafeAdapter(base: Adapter): Adapter {
  if (!base.linkAccount) throw new Error("Auth adapter does not support account linking");
  return {
    ...base,
    linkAccount: (account) => base.linkAccount!(withoutOAuthTokens(account)),
  };
}

export function createSecureAdapter(): Adapter {
  return wrapTokenSafeAdapter(DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }));
}
