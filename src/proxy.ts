import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "learnai_session";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_REQUEST = 1024 * 1024;

async function role(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !process.env.AUTH_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    return (payload.role as string) ?? null;
  } catch {
    return null;
  }
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

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/api/")) {
    // /api/jobs is called by cron with a shared secret, not by a browser.
    if (!SAFE_METHODS.has(req.method) && !path.startsWith("/api/jobs/") && crossSite(req))
      return NextResponse.json({ error: "CROSS_ORIGIN" }, { status: 403 });
    // Cheap early refusal of an honest oversized upload; handlers enforce their own, tighter cap on what actually arrives.
    if (Number(req.headers.get("content-length")) > MAX_REQUEST)
      return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });
    return NextResponse.next();
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
  // Next reads the nonce from the request's CSP header and applies it to its own scripts.
  headers.set("Content-Security-Policy", policy);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set(process.env.CSP_REPORT_ONLY === "1" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", policy);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
