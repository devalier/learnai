import { NextResponse } from "next/server";
import { qaErrorResponse, socialGuard } from "@/lib/qa";
import { attemptQuiz } from "@/lib/quiz";
import { readBody } from "@/lib/body";

export const dynamic = "force-dynamic";

/** Body: { answers: number[] } (option index per question). Passing holds the node; failing thins it. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { id } = await ctx.params;
  const parsed = await readBody(req);
  if ("res" in parsed) return parsed.res;
  const body = parsed.body;
  try {
    return NextResponse.json({ ok: true, ...(await attemptQuiz(g.userId, id, body.answers)) });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
