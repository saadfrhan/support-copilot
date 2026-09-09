import { readFile } from "node:fs/promises";
import pg from "pg";
import { deploymentErrors } from "../lib/deployment";

async function main() {
  const errors = deploymentErrors(process.env);
  const template = await readFile(`${process.cwd()}/.env.example`, "utf8");
  if (/^GOOGLE_API_KEY=\S+/m.test(template))
    errors.push(".env.example must not contain an API key.");
  if (errors.length) {
    for (const error of errors) console.error("FAIL: " + error);
    process.exitCode = 1;
  } else {
    console.log("Environment checks passed. Secret values are never printed.");
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 10000,
      statement_timeout: 10000,
    });
    try {
      await pool.query("SELECT id, embedding FROM chunks LIMIT 0");
      await pool.query("SELECT id, title FROM documents LIMIT 0");
      const extension = await pool.query(
        "SELECT extversion FROM pg_extension WHERE extname='vector'",
      );
      if (!extension.rowCount) throw new Error("Missing extension");
      const counts = await pool.query(
        "SELECT count(*)::int AS count FROM chunks WHERE embedding_model=$1",
        [process.env.EMBEDDING_MODEL],
      );
      console.log("Neon connection, pgvector, and schema checks passed.");
      console.log("Compatible chunks: " + counts.rows[0].count);
      if (!counts.rows[0].count)
        console.log("ACTION: Seed documents before sharing a public read-only demo.");
      if (process.env.ALLOW_DOCUMENT_WRITES === "true")
        console.log(
          "ACTION: Enable Vercel Deployment Protection for every URL before allowing visitors.",
        );
      console.log(
        "ACTION: Confirm Gemini model access and Vercel Firewall limits in the provider dashboards.",
      );
    } catch {
      console.error(
        "FAIL: Neon or schema check failed. Run db:setup:production and verify credentials.",
      );
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  }
}

main().catch(() => {
  console.error("Configuration script failed. Check the environment and required files.");
  process.exitCode = 1;
});
