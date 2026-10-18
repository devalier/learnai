import { NextResponse } from "next/server";
import { qaErrorResponse, reviewAnswer, socialGuard } from "@/lib/qa";
import { readBody } from "@/lib/body";

export const dynamic = "force-dynamic";

/** Challenge an AI judgement: the AI re-assesses it once, and says why. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { id } = await ctx.params;
  const parsed = await readBody(req);
  if ("res" in parsed) return parsed.res;
  const body = parsed.body;
  try {
    return NextResponse.json({ ok: true, ...(await reviewAnswer(g.userId, id, body.explanation)) });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
