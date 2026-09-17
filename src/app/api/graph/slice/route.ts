import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getGraphSlice } from "@/lib/graph";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const slice = await getGraphSlice(session?.sub);
  return NextResponse.json(slice);
}
