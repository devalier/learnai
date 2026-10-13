import { NextResponse } from "next/server";
import { qaErrorResponse, reviewAnswer, socialGuard } from "@/lib/qa";

export const dynamic = "force-dynamic";

/** Challenge an AI judgement: the AI re-assesses it once, and says why. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json({ ok: true, ...(await reviewAnswer(g.userId, id, body.explanation)) });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
