import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POLICY_VERSION } from "@/lib/legal";

export const dynamic = "force-dynamic";

/** Has the signed-in user seen the current Privacy Policy and Terms? */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ signedIn: false });
  const u = await prisma.user.findUnique({ where: { id: session.sub }, select: { termsVersion: true, presenceOptIn: true } });
  return NextResponse.json({ signedIn: true, version: POLICY_VERSION, needsAck: u?.termsVersion !== POLICY_VERSION, socialOn: !!u?.presenceOptIn });
}

/** "I have read the update." Recorded with the version, so there is a trail. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: session.sub }, data: { termsVersion: POLICY_VERSION, termsAcceptedAt: now } }),
    prisma.consentRecord.create({ data: { userId: session.sub, purpose: "POLICY", granted: true, policyVersion: POLICY_VERSION } }),
  ]);
  return NextResponse.json({ ok: true, version: POLICY_VERSION });
}
