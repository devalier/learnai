import { NextResponse } from "next/server";
import { qaErrorResponse, socialGuard } from "@/lib/qa";
import { createQuiz, listQuizzes } from "@/lib/quiz";
import { readBody } from "@/lib/body";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { slug } = await ctx.params;
  const quizzes = await listQuizzes(slug, g.userId);
  if (!quizzes) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ quizzes });
}

/** Ask the AI to write a new 3-question quiz on this node. Body: { focus? }. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { slug } = await ctx.params;
  const parsed = await readBody(req);
  if ("res" in parsed) return parsed.res;
  const body = parsed.body;
  try {
    return NextResponse.json({ ok: true, ...(await createQuiz(g.userId, slug, body.focus)) });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
