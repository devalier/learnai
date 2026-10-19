import { NextResponse } from "next/server";
import { getSession, revokeAllSessions, startSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readBody, str } from "@/lib/body";
import { TOO_MANY, hit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Sign out of every device, this one included, then start a fresh session here.
 * Body: { password }. The password is required so that someone holding a stolen
 * session cannot use this to lock the real owner out; it is throttled for the same
 * reason (it is a password check).
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (await hit(`signout-all:${session.sub}`, { max: 5, windowMs: 15 * 60 * 1000 })) return NextResponse.json(TOO_MANY, { status: 429 });
  const parsed = await readBody(req);
  if ("res" in parsed) return parsed.res;
  const password = str(parsed.body.password, 1000);
  const user = await prisma.user.findUnique({ where: { id: session.sub }, select: { id: true, email: true, name: true, role: true, passwordHash: true } });
  if (!user || !password || !(await verifyPassword(password, user.passwordHash)))
    return NextResponse.json({ error: "Wrong password." }, { status: 403 });
  const sessionVersion = await revokeAllSessions(user.id);
  await startSession({ id: user.id, email: user.email, name: user.name, role: user.role, sessionVersion });
  return NextResponse.json({ ok: true });
}
