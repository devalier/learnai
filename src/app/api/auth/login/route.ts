import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { TOO_MANY, clientIp, hit, reset } from "@/lib/ratelimit";
import { readBody, str } from "@/lib/body";

const WINDOW = 15 * 60 * 1000;
// A valid bcrypt hash (cost 10, same as real ones) of a random string nobody
// knows. Compared against when the account does not exist, so a missing
// account costs the same time as a wrong password.
const DUMMY_HASH = "$2b$10$F6qT/MLCk3v6J5ZFYHZgHOW2Bv546P6IHy1hacZAnX4HWjzocGTWm";

export async function POST(req: Request) {
  try {
    const parsed = await readBody(req);
    if ("res" in parsed) return parsed.res;
    const email = str(parsed.body.email, 254);
    // No upper bound short of the body cap would be needed for correctness (bcrypt reads 72 bytes); this just refuses nonsense.
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
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    await reset(emailKey);

    const now = new Date();
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now, lastSeenAt: now, loginCount: { increment: 1 } } });
    await setSessionCookie({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as "STUDENT" | "ADMIN",
    });
    return NextResponse.json({ ok: true, role: user.role });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
