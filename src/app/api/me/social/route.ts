import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { optIn, optOut } from "@/lib/privacy";
import { readBody } from "@/lib/body";

export const dynamic = "force-dynamic";

/**
 * Turn social features on or off for the signed-in user.
 * Turning on requires an explicit confirmation of age (16+) and of having read
 * the policies. Turning off deletes the user's social data.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = await readBody(req);

  if ("res" in parsed) return parsed.res;

  const body = parsed.body;
  if (body.enabled === true) {
    if (body.confirmAge !== true || body.confirmPolicies !== true)
      return NextResponse.json(
        { error: "Please confirm you are 16 or older and have read the Privacy Policy and Terms." },
        { status: 400 }
      );
    await optIn(session.sub);
    return NextResponse.json({ ok: true, enabled: true });
  }
  if (body.enabled === false) {
    await optOut(session.sub);
    return NextResponse.json({ ok: true, enabled: false });
  }
  return NextResponse.json({ error: "enabled must be true or false" }, { status: 400 });
}
