import { NextResponse } from "next/server";
import { qaErrorResponse, socialGuard } from "@/lib/qa";
import { stakeNode, unstakeNode } from "@/lib/stake";

export const dynamic = "force-dynamic";

/** Stake a node you hold, once you have 3 successes on it. It will not thin. */
export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { slug } = await ctx.params;
  try {
    await stakeNode(g.userId, slug);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return qaErrorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { slug } = await ctx.params;
  try {
    await unstakeNode(g.userId, slug);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
