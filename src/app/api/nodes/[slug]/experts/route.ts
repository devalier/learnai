import { NextResponse } from "next/server";
import { socialGuard } from "@/lib/qa";
import { getExperts } from "@/lib/stake";

export const dynamic = "force-dynamic";

/** Top 10 staked people on this node, by first name and rank only. Points are never returned. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { slug } = await ctx.params;
  const out = await getExperts(slug, g.userId);
  if (!out) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(out);
}
