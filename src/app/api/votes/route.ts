import { NextResponse } from "next/server";
import { castVote, qaErrorResponse, socialGuard } from "@/lib/qa";

export const dynamic = "force-dynamic";

/** Body: { questionId | answerId, value: 1 | -1 | 0 }. One vote per user per post. */
export async function POST(req: Request) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const body = await req.json().catch(() => ({}));
  try {
    await castVote(g.userId, { questionId: body.questionId, answerId: body.answerId }, body.value);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
