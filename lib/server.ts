import "server-only";
import { Pool } from "pg";
import { GoogleGenAI } from "@google/genai";
export const live = () => Boolean(process.env.GOOGLE_API_KEY && process.env.DATABASE_URL);
const globalDb = globalThis as unknown as { supportPool?: Pool };
export function db() {
  if (!globalDb.supportPool) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 5000,
      statement_timeout: 15000,
      allowExitOnIdle: true,
    });
    pool.on("error", () => console.error("Idle database connection failed."));
    globalDb.supportPool = pool;
  }
  return globalDb.supportPool;
}
export const embeddingModel = () => process.env.EMBEDDING_MODEL || "gemini-embedding-2";
export async function embed(text: string, signal?: AbortSignal) {
  const google = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  const response = await google.models.embedContent({
    model: embeddingModel(),
    contents: text,
    config: { outputDimensionality: 768, abortSignal: signal, httpOptions: { timeout: 20000 } },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values || values.length !== 768 || values.some((v) => !Number.isFinite(v)))
    throw new Error("Invalid embedding");
  return JSON.stringify(values);
}
export function failure(error: unknown) {
  console.error(error instanceof Error ? error.name : "Request failure");
  return Response.json(
    {
      error:
        "The service could not complete this request. Check your API key, model access, and database connection.",
    },
    { status: 503 },
  );
}
