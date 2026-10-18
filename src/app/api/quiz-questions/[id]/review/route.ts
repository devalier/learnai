import { NextResponse } from "next/server";
import { qaErrorResponse, socialGuard } from "@/lib/qa";
import { reviewQuizQuestion } from "@/lib/quiz";
import { readBody } from "@/lib/body";

export const dynamic = "force-dynamic";

/** Challenge a question's answer key: the AI re-checks it once. Body: { explanation }. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { id } = await ctx.params;
  const parsed = await readBody(req);
  if ("res" in parsed) return parsed.res;
  const body = parsed.body;
  try {
    return NextResponse.json({ ok: true, ...(await reviewQuizQuestion(g.userId, id, body.explanation)) });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
