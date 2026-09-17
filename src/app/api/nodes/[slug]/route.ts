import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getNodeDetail } from "@/lib/graph";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const session = await getSession();
  const detail = await getNodeDetail(slug, session?.sub);
  if (!detail) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(detail);
}
