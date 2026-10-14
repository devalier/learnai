import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { adminDecide } from "@/lib/expansion";
import { qaErrorResponse } from "@/lib/qa";

export const dynamic = "force-dynamic";

/** Body: { action: "approve" | "reject" | "retire" }. Admin only. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  if (body.action !== "approve" && body.action !== "reject" && body.action !== "retire")
    return NextResponse.json({ error: "BAD_ACTION" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await adminDecide(id, body.action)) });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
