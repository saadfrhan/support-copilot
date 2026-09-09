import { randomUUID } from "node:crypto";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { z } from "zod";
import { db, embed, embeddingModel, failure, live } from "@/lib/server";
import { documentWritesEnabled } from "@/lib/deployment";
import { demoDocuments } from "@/lib/demo";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET() {
  if (!live()) return Response.json({ documents: demoDocuments, mode: "demo" });
  try {
    const result = await db().query(
      "SELECT d.id,d.title,d.content,d.created_at,count(c.id)::int AS chunks FROM documents d LEFT JOIN chunks c ON c.document_id=d.id GROUP BY d.id ORDER BY d.created_at DESC",
    );
    return Response.json({ documents: result.rows, mode: "live" });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  if (!documentWritesEnabled())
    return Response.json(
      { error: "Document editing is disabled for this deployment." },
      { status: 403 },
    );
  if (!live())
    return Response.json(
      { error: "Connect Gemini and PostgreSQL to upload documents." },
      { status: 409 },
    );
  if (Number(request.headers.get("content-length")) > 220000)
    return Response.json({ error: "Document is too large." }, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > 210000)
      return Response.json({ error: "Document is too large." }, { status: 413 });
    const parsed = z
      .object({
        title: z.string().trim().min(1).max(160),
        content: z.string().trim().min(20).max(100000),
      })
      .safeParse(JSON.parse(raw));
    if (!parsed.success)
      return Response.json(
        { error: "Add a title and 20–100,000 characters of document text." },
        { status: 400 },
      );
    const { title, content } = parsed.data;
    const pieces = await new RecursiveCharacterTextSplitter({
      chunkSize: 1200,
      chunkOverlap: 180,
    }).splitText(content);
    const vectors: string[] = [];
    const deadline = AbortSignal.timeout(90000);
    for (const piece of pieces) vectors.push(await embed(piece, deadline));
    const client = await db().connect();
    const id = randomUUID();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO documents(id,title,content) VALUES($1,$2,$3)", [
        id,
        title,
        content,
      ]);
      for (let i = 0; i < pieces.length; i++)
        await client.query(
          "INSERT INTO chunks(document_id,content,embedding,embedding_model) VALUES($1,$2,$3::vector,$4)",
          [id, pieces[i], vectors[i], embeddingModel()],
        );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    return Response.json({ id, title, content, chunks: pieces.length }, { status: 201 });
  } catch (e) {
    if (e instanceof SyntaxError) return Response.json({ error: "Invalid JSON." }, { status: 400 });
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  if (!documentWritesEnabled())
    return Response.json(
      { error: "Document editing is disabled for this deployment." },
      { status: 403 },
    );
  if (!live())
    return Response.json(
      { error: "Sample documents are managed in your browser." },
      { status: 409 },
    );
  const id = new URL(request.url).searchParams.get("id");
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: "Invalid document ID." }, { status: 400 });
  try {
    await db().query("DELETE FROM documents WHERE id=$1", [id]);
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
