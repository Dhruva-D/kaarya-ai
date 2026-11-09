import { describe, expect, it, vi } from "vitest";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { withoutOAuthTokens, wrapTokenSafeAdapter } from "./secure-adapter";

const account = {
  userId: "user-1", type: "oauth", provider: "google", providerAccountId: "subject-1",
  access_token: "access-secret", refresh_token: "refresh-secret", id_token: "id-secret",
} satisfies AdapterAccount;

describe("Auth.js account storage", () => {
  it("removes every bearer or identity token from the account adapter row", () => {
    const safe = withoutOAuthTokens(account);
    expect(safe.access_token).toBeUndefined();
    expect(safe.refresh_token).toBeUndefined();
    expect(safe.id_token).toBeUndefined();
    expect(safe.providerAccountId).toBe("subject-1");
  });

  it("intercepts account linking before the Drizzle adapter write", async () => {
    const linkAccount = vi.fn(async () => undefined);
    const adapter = wrapTokenSafeAdapter({ linkAccount } as Adapter);
    await adapter.linkAccount!(account);
    expect(linkAccount).toHaveBeenCalledWith(withoutOAuthTokens(account));
    expect(JSON.stringify(linkAccount.mock.calls)).not.toContain("access-secret");
  });
});
