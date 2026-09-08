import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "learnai_session";

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

export async function middleware(req: NextRequest) {
  const r = await role(req);
  if (r !== "ADMIN") {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", "/admin");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
