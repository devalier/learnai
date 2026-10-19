import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { SESSION_COOKIE, cookieOptions, pastMaxAge, readToken, signToken, type SessionPayload } from "./sessiontoken";

export { SESSION_COOKIE };
export type { SessionPayload };

const SEEN_EVERY_MS = 60 * 60 * 1000;

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

/** Read current session from the cookie (server components / route handlers). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await readToken(token);
  if (!session) return null;
  // The token is stateless: a deleted account must not keep working on another device,
  // and nobody stays signed in for more than 30 days without typing their password.
  if (pastMaxAge(session)) return null;
  const u = await prisma.user.findUnique({ where: { id: session.sub }, select: { id: true, role: true, sessionVersion: true, passwordChangedAt: true, lastSeenAt: true } });
  if (!u) return null;
  // "Sign out of all devices" and a password reset raise the user's version; older tokens carry the old one.
  if ((session.sv ?? 0) !== u.sessionVersion) return null;
  // A password reset signs out every session issued before it.
  const iat = (session as unknown as { iat?: number }).iat;
  if (u.passwordChangedAt && (iat ?? 0) < Math.floor(u.passwordChangedAt.getTime() / 1000)) return null;
  // "Last seen": any signed-in use, written at most once an hour so reads stay cheap.
  // Never let a failure here break the request.
  if (!u.lastSeenAt || Date.now() - u.lastSeenAt.getTime() > SEEN_EVERY_MS)
    void prisma.user.update({ where: { id: u.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  // The role in the token is as old as the token; the database is current. A demoted admin loses access now.
  return { ...session, role: u.role };
}

/** Start a session for someone who has just proved who they are (password typed now). */
export async function startSession(user: { id: string; email: string; name: string; role: "STUDENT" | "ADMIN"; sessionVersion: number }): Promise<void> {
  const token = await signToken({
    sub: user.id, email: user.email, name: user.name, role: user.role,
    sv: user.sessionVersion, at: Math.floor(Date.now() / 1000),
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions());
}

/** Invalidate every session this user has, on every device. Returns the new version. */
export async function revokeAllSessions(userId: string): Promise<number> {
  const u = await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } }, select: { sessionVersion: true } });
  return u.sessionVersion;
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function requireUser(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHENTICATED");
  return s;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s || s.role !== "ADMIN") throw new Error("FORBIDDEN");
  return s;
}

export { prisma };
