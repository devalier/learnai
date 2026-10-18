import { NextResponse } from "next/server";
import { castVote, qaErrorResponse, socialGuard } from "@/lib/qa";
import { readBody, str } from "@/lib/body";

export const dynamic = "force-dynamic";

/** Body: { questionId | answerId, value: 1 | -1 | 0 }. One vote per user per post. */
export async function POST(req: Request) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const parsed = await readBody(req);
  if ("res" in parsed) return parsed.res;
  const body = parsed.body;
  try {
    await castVote(g.userId, { questionId: str(body.questionId, 64), answerId: str(body.answerId, 64) }, body.value);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
