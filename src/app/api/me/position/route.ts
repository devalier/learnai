import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isSchemaOutOfDate } from "@/lib/db";
import { getPosition } from "@/lib/holdings";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    const position = await getPosition(session.sub);
    return NextResponse.json(position);
  } catch (err) {
    if (!isSchemaOutOfDate(err)) throw err;
    return NextResponse.json({ error: "GRAPH_SCHEMA_MISSING" }, { status: 503 });
  }
}
