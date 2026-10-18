import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isSocialOptedIn } from "@/lib/privacy";
import { readBody, str } from "@/lib/body";

export const dynamic = "force-dynamic";

/** Take (or change) a position on a claim: one stance per user per claim. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!(await isSocialOptedIn(session.sub)))
    return NextResponse.json({ error: "SOCIAL_OPT_IN_REQUIRED" }, { status: 403 });

  const { id: claimId } = await ctx.params;
  const parsed = await readBody(req);
  if ("res" in parsed) return parsed.res;
  const { stance } = parsed.body;
  const statement = str(parsed.body.statement, 20000);
  if (stance !== "FOR" && stance !== "AGAINST")
    return NextResponse.json({ error: "stance must be FOR or AGAINST" }, { status: 400 });

  const claim = await prisma.claim.findUnique({ where: { id: claimId }, select: { id: true } });
  if (!claim) return NextResponse.json({ error: "claim not found" }, { status: 404 });

  const cleanStatement = (statement ?? "").slice(0, 2000);
  await prisma.claimPosition.upsert({
    where: { claimId_userId: { claimId, userId: session.sub } },
    update: { stance, statement: cleanStatement },
    create: { claimId, userId: session.sub, stance, statement: cleanStatement },
  });
  return NextResponse.json({ ok: true });
}
