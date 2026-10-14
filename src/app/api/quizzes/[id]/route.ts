import { NextResponse } from "next/server";
import { qaErrorResponse, socialGuard } from "@/lib/qa";
import { getQuiz } from "@/lib/quiz";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await getQuiz(g.userId, id));
  } catch (e) {
    return qaErrorResponse(e);
  }
}
