import { and, eq } from "drizzle-orm";
import { google } from "googleapis";
import { getDb } from "../../db/client";
import { googleConnections } from "../../db/schema";
import { decryptToken, encryptToken, parseTokenKey } from "../../security/token-crypto";

const calendarScope = "https://www.googleapis.com/auth/calendar.events";
const tasksScope = "https://www.googleapis.com/auth/tasks";
const gmailSendScope = "https://www.googleapis.com/auth/gmail.send";

export class CalendarConnectionUnavailable extends Error {}

export function hasCalendarScope(scopes: string): boolean {
  return scopes.split(/\s+/).includes(calendarScope);
}

export function hasTasksScope(scopes: string): boolean {
  return scopes.split(/\s+/).includes(tasksScope);
}

export function hasGmailSendScope(scopes: string): boolean {
  return scopes.split(/\s+/).includes(gmailSendScope);
}

async function getGoogleAuth(userId: string, requiredScope: string, label: string) {
  const db = getDb();
  const connections = await db.select().from(googleConnections)
    .where(and(eq(googleConnections.userId, userId), eq(googleConnections.status, "connected"))).limit(2);
  if (connections.length !== 1 || !connections[0].scopes.split(/\s+/).includes(requiredScope)) {
    throw new CalendarConnectionUnavailable(`Connect a Google account with ${label} permission`);
  }
  const connection = connections[0];
  const key = parseTokenKey(process.env.TOKEN_ENCRYPTION_KEY);
  const accessToken = decryptToken(connection.accessTokenCiphertext, key);
  const refreshToken = connection.refreshTokenCiphertext ? decryptToken(connection.refreshTokenCiphertext, key) : undefined;
  const auth = new google.auth.OAuth2(process.env.AUTH_GOOGLE_ID, process.env.AUTH_GOOGLE_SECRET);
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken, expiry_date: connection.expiresAt?.getTime() });

  if (connection.expiresAt && connection.expiresAt.getTime() <= Date.now() + 60_000) {
    if (!refreshToken) throw new CalendarConnectionUnavailable("Google access expired; reconnect your account");
    try {
      const updated = await auth.getAccessToken();
      if (!updated.token) throw new Error("No refreshed access token");
      await db.update(googleConnections).set({
        accessTokenCiphertext: encryptToken(updated.token, key),
        refreshTokenCiphertext: auth.credentials.refresh_token ? encryptToken(auth.credentials.refresh_token, key) : connection.refreshTokenCiphertext,
        expiresAt: auth.credentials.expiry_date ? new Date(auth.credentials.expiry_date) : null,
        updatedAt: new Date(),
      }).where(and(eq(googleConnections.id, connection.id), eq(googleConnections.userId, userId)));
    } catch {
      throw new CalendarConnectionUnavailable("Google access expired; reconnect your account");
    }
  }
  return auth;
}

export function getCalendarAuth(userId: string) {
  return getGoogleAuth(userId, calendarScope, "Calendar");
}

export function getTasksAuth(userId: string) {
  return getGoogleAuth(userId, tasksScope, "Tasks");
}

export function getGmailAuth(userId: string) {
  return getGoogleAuth(userId, gmailSendScope, "Gmail send");
}
