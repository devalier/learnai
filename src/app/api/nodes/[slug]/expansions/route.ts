import { NextResponse } from "next/server";
import { qaErrorResponse, socialGuard } from "@/lib/qa";
import { listMine, submitExpansion } from "@/lib/expansion";

export const dynamic = "force-dynamic";

/** Your own suggestions from this node. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { slug } = await ctx.params;
  const mine = await listMine(g.userId, slug);
  if (!mine) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ suggestions: mine });
}

/** Suggest a new node and a free source. Body: { nodeTitle, sourceUrl }. Stakers of this node only. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { slug } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json({ ok: true, ...(await submitExpansion(g.userId, slug, { nodeTitle: body.nodeTitle, sourceUrl: body.sourceUrl })) });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
