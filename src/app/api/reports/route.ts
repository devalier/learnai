import { NextResponse } from "next/server";
import { qaErrorResponse, socialGuard } from "@/lib/qa";
import { createReport } from "@/lib/report";

export const dynamic = "force-dynamic";

/** Report a post. Body: { kind: "question"|"answer"|"quiz", id, reason, note? }. */
export async function POST(req: Request) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json({ ok: true, ...(await createReport(g.userId, body)) });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
