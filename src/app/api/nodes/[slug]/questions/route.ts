import { NextResponse } from "next/server";
import { createQuestion, listQa, qaErrorResponse, socialGuard } from "@/lib/qa";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { slug } = await ctx.params;
  const out = await listQa(slug, g.userId);
  if (!out) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(out);
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { slug } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json({ ok: true, ...(await createQuestion(g.userId, slug, body.text)) });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
