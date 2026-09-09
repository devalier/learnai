import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password)
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    const normalized = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (!user || !(await verifyPassword(String(password), user.passwordHash)))
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

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
