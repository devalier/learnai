import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { exportUserData } from "@/lib/privacy";

export const dynamic = "force-dynamic";

/** Download everything we hold about the signed-in user as JSON. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const out = await exportUserData(session.sub);
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="learnai-my-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
