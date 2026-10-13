import { NextResponse } from "next/server";
import { clearSessionCookie, getSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteAccount } from "@/lib/privacy";

export const dynamic = "force-dynamic";

/**
 * Permanently delete the signed-in user's account and all their data.
 * Requires the password and the typed word DELETE; cannot be undone.
 */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "DELETE")
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.sub }, select: { passwordHash: true } });
  if (!user || typeof body.password !== "string" || !(await verifyPassword(body.password, user.passwordHash)))
    return NextResponse.json({ error: "Wrong password." }, { status: 403 });

  await deleteAccount(session.sub);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
