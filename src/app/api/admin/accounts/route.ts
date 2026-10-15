import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listAccounts, toCsv } from "@/lib/accounts";

export const dynamic = "force-dynamic";

/** All accounts with activity and status, as CSV. Admin only. */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const rows = (await listAccounts()).sort((a, b) => b.idleDays - a.idleDays);
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="learnai-accounts.csv"',
      "Cache-Control": "no-store",
    },
  });
}
