import { NextResponse } from "next/server";
import { createAnswer, qaErrorResponse, socialGuard } from "@/lib/qa";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await socialGuard();
  if ("res" in g) return g.res;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json({ ok: true, ...(await createAnswer(g.userId, id, body.text)) });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
