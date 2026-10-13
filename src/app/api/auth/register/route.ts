import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { MIN_AGE, POLICY_VERSION } from "@/lib/legal";

export async function POST(req: Request) {
  try {
    const { name, email, password, confirmAge, acceptTerms } = await req.json();
    if (!name || !email || !password)
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    if (typeof password !== "string" || password.length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    if (confirmAge !== true)
      return NextResponse.json({ error: `You must be ${MIN_AGE} or older to create an account.` }, { status: 400 });
    if (acceptTerms !== true)
      return NextResponse.json({ error: "Please accept the Terms and Privacy Policy." }, { status: 400 });
    const normalized = String(email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized))
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email: normalized } });
    if (existing)
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });

    const user = await prisma.user.create({
      data: {
        name: String(name).trim().slice(0, 80),
        email: normalized,
        passwordHash: await hashPassword(password),
        role: "STUDENT",
        ageConfirmedAt: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: POLICY_VERSION,
      },
    });

    await setSessionCookie({ sub: user.id, email: user.email, name: user.name, role: "STUDENT" });
    return NextResponse.json({ ok: true, role: "STUDENT" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
