import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { readBody } from "@/lib/body";
import { hit, TOO_MANY } from "@/lib/ratelimit";
import { cleanWorksheet } from "@/lib/worksheets";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Save a worksheet to the account. This is only ever called by the learner pressing a
 * button; nothing uploads local answers on its own. Body: { values, days }.
 */
export async function PUT(req: Request, ctx: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (await hit(`worksheet:user:${s.sub}`, { max: 60, windowMs: 60 * 60 * 1000 })) return NextResponse.json(TOO_MANY, { status: 429 });
  const { code } = await ctx.params;
  const parsed = await readBody(req, 128 * 1024);
  if ("res" in parsed) return parsed.res;
  const c = cleanWorksheet(code, parsed.body.values, parsed.body.days);
  if (!c.ok) return NextResponse.json({ error: "UNKNOWN_WORKSHEET" }, { status: 404 });
  const row = await prisma.worksheetEntry.upsert({
    where: { userId_exerciseCode: { userId: s.sub, exerciseCode: c.code } },
    update: { values: c.values, days: c.days },
    create: { userId: s.sub, exerciseCode: c.code, values: c.values, days: c.days },
    select: { updatedAt: true },
  });
  return NextResponse.json({ ok: true, updatedAt: row.updatedAt, skipped: c.skipped });
}

/** Remove the account copy. The copy on the learner's device is not touched. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { code } = await ctx.params;
  await prisma.worksheetEntry.deleteMany({ where: { userId: s.sub, exerciseCode: code } });
  return NextResponse.json({ ok: true });
}
