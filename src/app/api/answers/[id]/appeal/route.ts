import { NextResponse } from "next/server";
import { socialGuard, qaErrorResponse } from "@/lib/qa";
import { appealAnswer } from "@/lib/appeal";

/** Ask an admin to review your answer's judgement, after the AI's one re-check. Body: { explanation }. Author only. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { id } = await ctx.params;
  const raw: unknown = await req.json().catch(() => null);
  const body = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  try {
    await appealAnswer(g.userId, id, body.explanation);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
