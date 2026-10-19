import { SignJWT, jwtVerify } from "jose";

/**
 * The session token itself: signing, reading and its lifetime rules. No database
 * and no next/headers, so the proxy (which re-issues tokens) and the server code
 * (which decides whether to honour them) share one definition.
 *
 * Lifetime:
 *  - a token lives 7 days (`exp`);
 *  - the proxy re-issues it on a GET once it is more than a day old, so an active
 *    user stays signed in;
 *  - but never beyond 30 days after they last typed their password (`at`), so a
 *    stolen cookie cannot be kept alive for ever by using it.
 * Revocation: `sv` must equal the user's current sessionVersion (see auth.ts).
 * Tokens issued before these claims existed have neither; they count as sv 0 and
 * as logged in at their `iat`, so deploying this signs nobody out.
 */

export const SESSION_COOKIE = "learnai_session";
export const TOKEN_TTL_S = 7 * 24 * 60 * 60;
export const REFRESH_AFTER_S = 24 * 60 * 60;
export const MAX_SESSION_S = 30 * 24 * 60 * 60;
const ALG = "HS256";

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: "STUDENT" | "ADMIN";
  /** session version at issue; absent on tokens from before it existed */
  sv?: number;
  /** when the password was last typed (unix seconds); absent on older tokens */
  at?: number;
};
export type ReadToken = SessionPayload & { iat: number; exp: number };

function key(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function signToken(p: SessionPayload): Promise<string> {
  return new SignJWT({ ...p })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_S}s`)
    .sign(key());
}

/** The token's claims if the signature and expiry check out, else null. Only HS256 is accepted. */
export async function readToken(token: string): Promise<ReadToken | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: [ALG] });
    if (typeof payload.sub !== "string" || typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;
    return payload as unknown as ReadToken;
  } catch {
    return null;
  }
}

const now = () => Math.floor(Date.now() / 1000);

/** Seconds since the person last typed their password. */
export const sessionAge = (t: ReadToken) => now() - (t.at ?? t.iat);

/** Past the absolute limit: they must sign in again, whatever `exp` says. */
export const pastMaxAge = (t: ReadToken) => sessionAge(t) > MAX_SESSION_S;

/** Worth re-issuing: more than a day old and still inside the absolute limit. */
export const needsRefresh = (t: ReadToken) => now() - t.iat > REFRESH_AFTER_S && !pastMaxAge(t);

export const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: TOKEN_TTL_S,
});
