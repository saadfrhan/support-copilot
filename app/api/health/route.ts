import { db, live } from "@/lib/server";
export const runtime = "nodejs";
export const maxDuration = 15;
export const dynamic = "force-dynamic";

export async function GET() {
  if (!live()) return Response.json({ ok: true, mode: "demo" });
  try {
    await db().query("SELECT id, embedding FROM chunks LIMIT 0");
    await db().query("SELECT id FROM documents LIMIT 0");
    return Response.json({ ok: true, mode: "live", database: "ready" });
  } catch {
    return Response.json({ ok: false, database: "unavailable" }, { status: 503 });
  }
}
