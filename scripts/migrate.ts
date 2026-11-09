import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL in .env.local before migrating");

const pool = new Pool({ connectionString, max: 2 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.log("Database migrations applied");
} finally {
  await pool.end();
}
