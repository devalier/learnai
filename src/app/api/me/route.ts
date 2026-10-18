import { NextResponse } from "next/server";
import { clearSessionCookie, getSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteAccount } from "@/lib/privacy";
import { TOO_MANY, hit } from "@/lib/ratelimit";
import { readBody } from "@/lib/body";

export const dynamic = "force-dynamic";

/**
 * Permanently delete the signed-in user's account and all their data.
 * Requires the password and the typed word DELETE; cannot be undone.
 */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  // The password is checked here, so a stolen session could otherwise be used to guess it.
  if (await hit(`delete:${session.sub}`, { max: 5, windowMs: 15 * 60 * 1000 })) return NextResponse.json(TOO_MANY, { status: 429 });
  const parsed = await readBody(req);
  if ("res" in parsed) return parsed.res;
  const body = parsed.body;
  if (body.confirm !== "DELETE")
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.sub }, select: { passwordHash: true } });
  if (!user || typeof body.password !== "string" || !(await verifyPassword(body.password, user.passwordHash)))
    return NextResponse.json({ error: "Wrong password." }, { status: 403 });

  await deleteAccount(session.sub);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
