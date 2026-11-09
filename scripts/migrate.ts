import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Set DATABASE_URL in .env.local before migrating");

  const pool = new Pool({ connectionString, max: 2 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    console.log("Database migrations applied");
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error("Database migration failed:", error instanceof Error ? error.message : "Unknown error");
  const cause = error instanceof Error && "cause" in error ? error.cause : undefined;
  if (cause && typeof cause === "object" && "code" in cause) {
    const databaseError = cause as { code?: unknown; message?: unknown; detail?: unknown };
    console.error("PostgreSQL:", databaseError.code, databaseError.message, databaseError.detail ?? "");
  }
  process.exitCode = 1;
});
