import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPosition } from "@/lib/holdings";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const position = await getPosition(session.sub);
  return NextResponse.json(position);
}
