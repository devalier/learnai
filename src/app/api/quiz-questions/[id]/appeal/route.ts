import { NextResponse } from "next/server";
import { socialGuard, qaErrorResponse } from "@/lib/qa";
import { appealQuizQuestion } from "@/lib/appeal";

/** Ask an admin to review an answer key, after the AI's one re-check. Body: { explanation }. Only for a question you took and got wrong. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { id } = await ctx.params;
  const raw: unknown = await req.json().catch(() => null);
  const body = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  try {
    await appealQuizQuestion(g.userId, id, body.explanation);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
