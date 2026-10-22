import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** The signed-in learner's account copies of worksheets: { code: { values, days, updatedAt } }. */
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const rows = await prisma.worksheetEntry.findMany({
    where: { userId: s.sub },
    select: { exerciseCode: true, values: true, days: true, updatedAt: true },
  });
  return NextResponse.json({
    entries: Object.fromEntries(rows.map((r) => [r.exerciseCode, { values: r.values, days: r.days, updatedAt: r.updatedAt }])),
  });
}
