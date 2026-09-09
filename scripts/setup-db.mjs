import pg from "pg";
import { readFile } from "node:fs/promises";

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("Set DATABASE_URL_UNPOOLED or DATABASE_URL before schema setup.");
const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
});
try {
  await pool.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
  console.log("Database schema ready.");
} catch {
  console.error("Schema setup failed. Verify the connection, TLS, and database role permissions.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
