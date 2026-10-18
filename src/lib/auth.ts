import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

export const SESSION_COOKIE = "learnai_session";
const ALG = "HS256";
const SEEN_EVERY_MS = 60 * 60 * 1000;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: "STUDENT" | "ADMIN";
};

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Read current session from the cookie (server components / route handlers). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  // The token is stateless and lives 30 days: a deleted account must not keep
  // working on another device.
  const u = await prisma.user.findUnique({ where: { id: session.sub }, select: { id: true, role: true, passwordChangedAt: true, lastSeenAt: true } });
  if (!u) return null;
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

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
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
