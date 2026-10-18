import { NextResponse } from "next/server";
import { ResetError, checkToken, resetPassword } from "@/lib/passwordreset";
import { readBody } from "@/lib/body";

export const dynamic = "force-dynamic";

/** Is the link still good? Body: { token }. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  return NextResponse.json({ valid: await checkToken(token) });
}

/** Body: { token, password }. The link works once. Existing sessions are signed out. */
export async function POST(req: Request) {
  const parsed = await readBody(req);
  if ("res" in parsed) return parsed.res;
  const body = parsed.body;
  try {
    await resetPassword(typeof body.token === "string" ? body.token : "", body.password);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ResetError) return NextResponse.json({ error: e.code, message: e.message }, { status: 400 });
    throw e;
  }
}
