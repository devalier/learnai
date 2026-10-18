import { NextResponse } from "next/server";
import { isSchemaOutOfDate, prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recomputeProvisionalHoldings } from "@/lib/holdings";
import { sameResourceIds } from "@/lib/sameresource";
import { readBody, str } from "@/lib/body";

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

  const parsed = await readBody(req);
  if ("res" in parsed) return parsed.res;
  const moduleId = str(parsed.body.moduleId, 64);
  const resourceId = str(parsed.body.resourceId, 64);
  const completed = parsed.body.completed === true;
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
  }

  // A video placed in several modules is one video: tick or untick every copy.
  if (resourceId) {
    const ids = await sameResourceIds(resourceId);
    if (completed) {
      for (const id of ids)
        await prisma.progress.upsert({
          where: { userId_resourceId: { userId: s.sub, resourceId: id } },
          update: { completed: true },
          create: { userId: s.sub, resourceId: id, completed: true },
        });
    } else {
      await prisma.progress.deleteMany({ where: { userId: s.sub, resourceId: { in: ids } } });
    }
  }

  // Mirror the tick into the knowledge graph as provisional holdings. The tick
  // itself is already saved, so never fail the request when the graph tables
  // are not in the database yet.
  try {
    await recomputeProvisionalHoldings(s.sub);
  } catch (err) {
    if (!isSchemaOutOfDate(err)) throw err;
  }

  return NextResponse.json({ ok: true });
}
