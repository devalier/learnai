import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { decideAppeal } from "@/lib/appeal";
import { qaErrorResponse } from "@/lib/qa";

export const dynamic = "force-dynamic";

/** Body: { kind: "answer" | "quiz", id, action: "uphold" | "overturn" | "fix" | "void", correctIndex?, note? }. Admin only. */
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const raw: unknown = await req.json().catch(() => null);
  const body = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const b = body;
  try {
    return NextResponse.json({ ok: true, ...(await decideAppeal(b.kind, b.id, b.action, { correctIndex: b.correctIndex, note: b.note })) });
  } catch (e) {
    return qaErrorResponse(e);
  }
}
