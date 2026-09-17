import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { syncHoldingsForModule } from "@/lib/holdings";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const rows = await prisma.progress.findMany({
    where: { userId: s.sub, completed: true },
    select: { moduleId: true, resourceId: true },
  });
  return NextResponse.json({
    modules: rows.map((r) => r.moduleId).filter(Boolean),
    resources: rows.map((r) => r.resourceId).filter(Boolean),
  });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { moduleId, resourceId, completed } = await req.json();
  if (!moduleId && !resourceId)
    return NextResponse.json({ error: "moduleId or resourceId required" }, { status: 400 });

  if (moduleId) {
    if (completed) {
      await prisma.progress.upsert({
        where: { userId_moduleId: { userId: s.sub, moduleId } },
        update: { completed: true },
        create: { userId: s.sub, moduleId, completed: true },
      });
    } else {
      await prisma.progress.deleteMany({ where: { userId: s.sub, moduleId } });
    }
    // Mirror the tick into the knowledge graph as provisional holdings.
    const mod = await prisma.module.findUnique({ where: { id: moduleId }, select: { code: true } });
    if (mod?.code) await syncHoldingsForModule(s.sub, mod.code, !!completed);
  }

  if (resourceId) {
    if (completed) {
      await prisma.progress.upsert({
        where: { userId_resourceId: { userId: s.sub, resourceId } },
        update: { completed: true },
        create: { userId: s.sub, resourceId, completed: true },
      });
    } else {
      await prisma.progress.deleteMany({ where: { userId: s.sub, resourceId } });
    }
  }

  return NextResponse.json({ ok: true });
}
