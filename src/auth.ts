import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { createSecureAdapter } from "./lib/auth/secure-adapter";
import { saveGoogleConnection } from "./lib/auth/google-connection";
import { parseTokenKey } from "./lib/security/token-crypto";

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  if (!process.env.AUTH_SECRET || !process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    throw new Error("Google authentication is not configured");
  }
  parseTokenKey(process.env.TOKEN_ENCRYPTION_KEY);
  return {
    adapter: createSecureAdapter(),
    session: { strategy: "database" },
    providers: [Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: "openid email profile https://www.googleapis.com/auth/calendar.events",
        },
      },
    })],
    events: {
      async signIn({ user, account }) {
        if (account?.provider === "google" && user.id) await saveGoogleConnection(user.id, account);
      },
    },
    pages: { signIn: "/sign-in" },
  };
});
