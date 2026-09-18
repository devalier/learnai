import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Take (or change) a position on a claim: one stance per user per claim. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { id: claimId } = await ctx.params;
  const { stance, statement } = await req.json();
  if (stance !== "FOR" && stance !== "AGAINST")
    return NextResponse.json({ error: "stance must be FOR or AGAINST" }, { status: 400 });

  const claim = await prisma.claim.findUnique({ where: { id: claimId }, select: { id: true } });
  if (!claim) return NextResponse.json({ error: "claim not found" }, { status: 404 });

  const cleanStatement = statement ? String(statement).slice(0, 2000) : "";
  await prisma.claimPosition.upsert({
    where: { claimId_userId: { claimId, userId: session.sub } },
    update: { stance, statement: cleanStatement },
    create: { claimId, userId: session.sub, stance, statement: cleanStatement },
  });
  return NextResponse.json({ ok: true });
}
