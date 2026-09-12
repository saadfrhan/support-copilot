import { randomUUID } from "node:crypto";
import pg from "pg";
import { GoogleGenAI } from "@google/genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { demoDocuments } from "../lib/demo";

async function main() {
  if (!process.env.GOOGLE_API_KEY || !process.env.DATABASE_URL) {
    console.error("Set GOOGLE_API_KEY and DATABASE_URL in .env.local or the environment.");
    process.exit(1);
  }
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
  });
  const google = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  const model = process.env.EMBEDDING_MODEL || "gemini-embedding-2";
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1200, chunkOverlap: 180 });
  try {
    for (const doc of demoDocuments) {
      const existing = await pool.query(
        "SELECT d.id FROM documents d JOIN chunks c ON c.document_id=d.id WHERE d.title=$1 AND d.content=$2 AND c.embedding_model=$3 LIMIT 1",
        [doc.title, doc.content, model],
      );
      if (existing.rowCount) {
        console.log("Already indexed: " + doc.title);
        continue;
      }
      const chunks = await splitter.splitText(doc.content);
      const vectors: string[] = [];
      for (const chunk of chunks) {
        const response = await google.models.embedContent({
          model,
          contents: chunk,
          config: { outputDimensionality: 768, httpOptions: { timeout: 20000 } },
        });
        const values = response.embeddings?.[0]?.values;
        if (!values || values.length !== 768 || values.some((v) => !Number.isFinite(v)))
          throw new Error("Invalid embedding");
        vectors.push(JSON.stringify(values));
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const id = randomUUID();
        await client.query("INSERT INTO documents(id,title,content) VALUES($1,$2,$3)", [
          id,
          doc.title,
          doc.content,
        ]);
        for (let i = 0; i < chunks.length; i++) {
          await client.query(
            "INSERT INTO chunks(document_id,content,embedding,embedding_model) VALUES($1,$2,$3::vector,$4)",
            [id, chunks[i], vectors[i], model],
          );
        }
        await client.query("COMMIT");
        console.log("Indexed: " + doc.title);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  } catch {
    console.error(
      "Seeding failed. Verify the database schema, API key, and embedding model access.",
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  console.error("Configuration script failed. Check the environment and required files.");
  process.exitCode = 1;
});
