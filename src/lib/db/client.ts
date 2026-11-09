import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalPool = globalThis as typeof globalThis & { kaaryaPool?: Pool };

export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  const pool = globalPool.kaaryaPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  globalPool.kaaryaPool = pool;
  return drizzle(pool, { schema });
}
