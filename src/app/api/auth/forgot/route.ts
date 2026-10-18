import { NextResponse } from "next/server";
import { after } from "next/server";
import { requestReset } from "@/lib/passwordreset";
import { TOO_MANY, clientIp, hit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// A small per-address limit on top of the per-account one, so this cannot be used
// to flood someone's inbox or to probe many addresses.

const SAME = { ok: true, message: "If that email has an account, we have sent a link to reset the password. It works for one hour." };

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) || email.length > 254)
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (await hit(`forgot:ip:${clientIp(req)}`, { max: 10, windowMs: 60 * 60 * 1000 }))
    return NextResponse.json(TOO_MANY, { status: 429 });
  // Do the lookup and the sending after answering: the response time never tells
  // whether the address has an account.
  after(() => requestReset(email).catch((e) => console.error("reset request failed:", e)));
  return NextResponse.json(SAME);
}
