import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();
    if (!name || !email || !password)
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    if (typeof password !== "string" || password.length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
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
      },
    });

    await setSessionCookie({ sub: user.id, email: user.email, name: user.name, role: "STUDENT" });
    return NextResponse.json({ ok: true, role: "STUDENT" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
