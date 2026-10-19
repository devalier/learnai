import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, cookieOptions, needsRefresh, pastMaxAge, readToken, signToken } from "@/lib/sessiontoken";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_REQUEST = 1024 * 1024;

async function role(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !process.env.AUTH_SECRET) return null;
  const t = await readToken(token);
  return t && !pastMaxAge(t) ? t.role : null;
}

/**
 * Sliding expiry. A session token lives 7 days; on a GET, once it is over a day old,
 * a fresh one (same login time, same version) goes out with the response, so an active
 * user stays signed in but a 30-day limit from their last password still applies.
 * It is done here because server components cannot set cookies. Only GET and HEAD:
 * login, logout, sign-out-everywhere and account deletion are POST or DELETE and set or
 * clear the cookie themselves, and a refresh must never race them. This does not check
 * the database: a revoked token may be re-issued, and is still refused by getSession.
 */
async function refreshed(req: NextRequest, res: NextResponse): Promise<NextResponse> {
  if (req.method !== "GET" && req.method !== "HEAD") return res;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return res;
  const t = await readToken(token);
  if (!t || !needsRefresh(t)) return res;
  res.cookies.set(SESSION_COOKIE, await signToken({ sub: t.sub, email: t.email, name: t.name, role: t.role, sv: t.sv ?? 0, at: t.at ?? t.iat }), cookieOptions());
  return res;
}

/**
 * CSRF defence on top of the SameSite=lax cookie: a state-changing API request
 * that a browser says came from another site is refused. Browsers always send
 * Sec-Fetch-Site and (on non-GET) Origin; a request with neither is not a
 * browser, carries no cookie to abuse, and is let through.
 */
function crossSite(req: NextRequest): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set<string>();
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) allowed.add(host.toLowerCase());
  if (process.env.APP_URL) {
    try {
      allowed.add(new URL(process.env.APP_URL).host.toLowerCase());
    } catch {}
  }
  try {
    return !allowed.has(new URL(origin).host.toLowerCase());
  } catch {
    return true; // "null" or garbage
  }
}

/**
 * Strict CSP with a per-request nonce. Every page here is already dynamically
 * rendered, so nonces cost nothing. Scripts need the nonce ('strict-dynamic'
 * lets the nonced bootstrap load the rest); styles allow inline because React
 * renders style="" attributes, which a nonce cannot cover. CSP_REPORT_ONLY=1
 * switches to report-only mode without a code change.
 */
function csp(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Every request gets an id, returned in the `x-request-id` response header and passed to
 * the handlers (which put it in their log lines), so a user's report can be matched to the
 * log. One supplied by a proxy is kept if it is plain and short; anything else is replaced,
 * so a client cannot inject odd characters into the log.
 */
const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;
function requestId(req: NextRequest): string {
  const given = req.headers.get("x-request-id");
  return given && REQUEST_ID.test(given) ? given : crypto.randomUUID();
}

export async function proxy(req: NextRequest) {
  const id = requestId(req);
  const res = await handle(req, id);
  res.headers.set("x-request-id", id);
  return res;
}

async function handle(req: NextRequest, id: string): Promise<NextResponse> {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/api/")) {
    // /api/jobs is called by cron with a shared secret, not by a browser.
    if (!SAFE_METHODS.has(req.method) && !path.startsWith("/api/jobs/") && crossSite(req))
      return NextResponse.json({ error: "CROSS_ORIGIN" }, { status: 403 });
    // Cheap early refusal of an honest oversized upload; handlers enforce their own, tighter cap on what actually arrives.
    if (Number(req.headers.get("content-length")) > MAX_REQUEST)
      return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });
    const forward = new Headers(req.headers);
    forward.set("x-request-id", id);
    return refreshed(req, NextResponse.next({ request: { headers: forward } }));
  }

  if (path === "/admin" || path.startsWith("/admin/")) {
    if ((await role(req)) !== "ADMIN") {
      const url = new URL("/login", req.url);
      url.searchParams.set("next", "/admin");
      return NextResponse.redirect(url);
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("x-request-id", id);
  // Next reads the nonce from the request's CSP header and applies it to its own scripts.
  headers.set("Content-Security-Policy", policy);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set(process.env.CSP_REPORT_ONLY === "1" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", policy);
  return refreshed(req, res);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
