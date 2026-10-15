import { NextResponse } from "next/server";
import { after } from "next/server";
import { requestReset } from "@/lib/passwordreset";

export const dynamic = "force-dynamic";

// A small per-address limit on top of the per-account one, so this cannot be used
// to flood someone's inbox or to probe many addresses.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t > 60 * 60 * 1000)) hits.delete(k);
  return recent.length > 10;
}

const SAME = { ok: true, message: "If that email has an account, we have sent a link to reset the password. It works for one hour." };

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) || email.length > 254)
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  // Do the lookup and the sending after answering: the response time never tells
  // whether the address has an account.
  after(() => requestReset(email).catch((e) => console.error("reset request failed:", e)));
  return NextResponse.json(SAME);
}
