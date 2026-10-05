import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isSchemaOutOfDate } from "@/lib/db";
import { getGraphSlice } from "@/lib/graph";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  try {
    const slice = await getGraphSlice(session?.sub);
    return NextResponse.json(slice);
  } catch (err) {
    if (!isSchemaOutOfDate(err)) throw err;
    return NextResponse.json({ error: "GRAPH_SCHEMA_MISSING" }, { status: 503 });
  }
}
