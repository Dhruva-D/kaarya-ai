import { lt, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { providerRateLimits } from "../db/schema";

const windowMs = 10 * 60_000;
const limits = { chat: 20, gnani_stt: 10, gnani_tts: 20 } as const;
export type MeteredOperation = keyof typeof limits;

export function rateWindowStart(now = new Date()): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

/** Atomic insert/increment; no returned row means the user exceeded this window. */
export async function claimProviderBudget(userId: string, operation: MeteredOperation): Promise<boolean> {
  const [row] = await getDb().insert(providerRateLimits)
    .values({ userId, operation, windowStart: rateWindowStart(), count: 1 })
    .onConflictDoUpdate({
      target: [providerRateLimits.userId, providerRateLimits.operation, providerRateLimits.windowStart],
      set: { count: sql`${providerRateLimits.count} + 1` },
      setWhere: lt(providerRateLimits.count, limits[operation]),
    }).returning({ count: providerRateLimits.count });
  return Boolean(row);
}
