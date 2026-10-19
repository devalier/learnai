import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, startSession } from "@/lib/auth";
import { MIN_AGE, POLICY_VERSION } from "@/lib/legal";
import { TOO_MANY, clientIp, hit } from "@/lib/ratelimit";
import { oneLine, readBody, str } from "@/lib/body";

export async function POST(req: Request) {
  try {
    // Hashing is deliberately slow, so unthrottled sign-ups are also a CPU drain.
    if (await hit(`register:ip:${clientIp(req)}`, { max: 10, windowMs: 60 * 60 * 1000 }))
      return NextResponse.json(TOO_MANY, { status: 429 });
    const parsed = await readBody(req);
    if ("res" in parsed) return parsed.res;
    const { confirmAge, acceptTerms } = parsed.body;
    const name = oneLine(str(parsed.body.name, 200) ?? "").slice(0, 80);
    const email = str(parsed.body.email, 254);
    const password = str(parsed.body.password, 1000);
    if (!name || !email || !password)
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    if (password.length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    // bcrypt only reads the first 72 bytes: a longer password would be accepted and silently cut.
    if (Buffer.byteLength(password) > 72)
      return NextResponse.json({ error: "Password must be at most 72 bytes (about 72 characters)." }, { status: 400 });
    if (confirmAge !== true)
      return NextResponse.json({ error: `You must be ${MIN_AGE} or older to create an account.` }, { status: 400 });
    if (acceptTerms !== true)
      return NextResponse.json({ error: "Please accept the Terms and Privacy Policy." }, { status: 400 });
    const normalized = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized))
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email: normalized } });
    if (existing)
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });

    const user = await prisma.user.create({
      data: {
        name,
        email: normalized,
        passwordHash: await hashPassword(password),
        role: "STUDENT",
        ageConfirmedAt: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: POLICY_VERSION,
        // Signing up signs you in: that is the first login.
        lastLoginAt: new Date(),
        lastSeenAt: new Date(),
        loginCount: 1,
      },
    });

    await startSession({ id: user.id, email: user.email, name: user.name, role: "STUDENT", sessionVersion: user.sessionVersion });
    return NextResponse.json({ ok: true, role: "STUDENT" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
