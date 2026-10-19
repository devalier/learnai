import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dummyHash, startSession, upgradePasswordHash, verifyPassword } from "@/lib/auth";
import { TOO_MANY, clientIp, hit, reset } from "@/lib/ratelimit";
import { readBody, str } from "@/lib/body";

const WINDOW = 15 * 60 * 1000;
export async function POST(req: Request) {
  try {
    const parsed = await readBody(req);
    if ("res" in parsed) return parsed.res;
    const email = str(parsed.body.email, 254);
    // Just refuses nonsense; the body cap already bounds the size.
    const password = str(parsed.body.password, 1000);
    if (!email || !password)
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    const normalized = email.trim().toLowerCase();

    // Per address (spraying many accounts) and per account (guessing one).
    // Both are checked so neither short-circuits the other's count.
    const emailKey = `login:email:${normalized.slice(0, 254)}`;
    const [ipHot, emailHot] = await Promise.all([
      hit(`login:ip:${clientIp(req)}`, { max: 20, windowMs: WINDOW }),
      hit(emailKey, { max: 5, windowMs: WINDOW }),
    ]);
    if (ipHot || emailHot) return NextResponse.json(TOO_MANY, { status: 429 });

    const user = await prisma.user.findUnique({ where: { email: normalized } });
    // An unknown email is checked against a dummy hash, so it costs the same as a wrong password.
    const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
    if (!user || !ok) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    await reset(emailKey);
    await upgradePasswordHash(user.id, password, user.passwordHash);

    const now = new Date();
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now, lastSeenAt: now, loginCount: { increment: 1 } } });
    await startSession({ id: user.id, email: user.email, name: user.name, role: user.role as "STUDENT" | "ADMIN", sessionVersion: user.sessionVersion });
    return NextResponse.json({ ok: true, role: user.role });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
