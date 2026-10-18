import { NextResponse } from "next/server";
import { qaErrorResponse, socialGuard } from "@/lib/qa";
import { rateQuiz } from "@/lib/quiz";
import { readBody } from "@/lib/body";

export const dynamic = "force-dynamic";

/** Body: { value: 1 | -1 | 0 }. Only people who passed the quiz may rate it. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { id } = await ctx.params;
  const parsed = await readBody(req);
  if ("res" in parsed) return parsed.res;
  const body = parsed.body;
  try {
    await rateQuiz(g.userId, id, body.value);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
