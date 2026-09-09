import { documentWritesEnabled } from "@/lib/deployment";
import { db, live } from "@/lib/server";
export const runtime = "nodejs";
export const maxDuration = 15;
export async function GET() {
  let database = false;
  if (process.env.DATABASE_URL) {
    try {
      await db().query("SELECT id FROM chunks LIMIT 0");
      database = true;
    } catch {
      /* Report a setup problem without exposing connection details. */
    }
  }
  return Response.json({
    mode: live() ? "live" : "demo",
    google: Boolean(process.env.GOOGLE_API_KEY),
    database,
    documentWrites: documentWritesEnabled(),
  });
}
