import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { qaErrorResponse } from "@/lib/qa";
import { moderate } from "@/lib/report";
import { readBody } from "@/lib/body";

export const dynamic = "force-dynamic";

/** Body: { kind, id, action: "hide" | "restore" | "dismiss" }. Admin only. */
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const parsed = await readBody(req);
  if ("res" in parsed) return parsed.res;
  const body = parsed.body;
  try {
    return NextResponse.json(await moderate(body.kind, body.id, body.action));
  } catch (e) {
    return qaErrorResponse(e);
  }
}
