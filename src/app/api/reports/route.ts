import { NextResponse } from "next/server";
import { qaErrorResponse, socialGuard } from "@/lib/qa";
import { createReport } from "@/lib/report";
import { readBody } from "@/lib/body";

export const dynamic = "force-dynamic";

/** Report a post. Body: { kind: "question"|"answer"|"quiz", id, reason, note? }. */
export async function POST(req: Request) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const parsed = await readBody(req);
  if ("res" in parsed) return parsed.res;
  const body = parsed.body;
  try {
    return NextResponse.json({ ok: true, ...(await createReport(g.userId, { kind: body.kind, id: body.id, reason: body.reason, note: body.note })) });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
