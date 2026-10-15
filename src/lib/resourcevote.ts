import { prisma } from "./db";
import { QaError } from "./qa";

/**
 * Rating resources (videos, articles, ...). You can thumb a resource up or down
 * once you have a verified hold on a node it covers: a hold you earned by passing
 * a quiz or answering correctly, not one that only comes from ticking the resource
 * itself. Your own vote is shown to you; admins see the totals.
 */

const COVERS = ["DEFINES", "DEMONSTRATES"] as const;

/** Resource ids this user may rate. */
export async function ratableResourceIds(userId: string): Promise<Set<string>> {
  const holds = await prisma.holding.findMany({ where: { userId, provisional: false }, select: { nodeId: true } });
  if (holds.length === 0) return new Set();
  const cov = await prisma.coverage.findMany({
    where: { nodeId: { in: holds.map((h) => h.nodeId) }, depth: { in: [...COVERS] } },
    select: { resourceId: true },
  });
  return new Set(cov.map((c) => c.resourceId));
}

export async function myResourceVotes(userId: string): Promise<Map<string, number>> {
  const rows = await prisma.resourceVote.findMany({ where: { userId }, select: { resourceId: true, value: true } });
  return new Map(rows.map((r) => [r.resourceId, r.value]));
}

/** value: 1, -1, or 0 to withdraw. */
export async function voteResource(userId: string, resourceId: string, value: unknown) {
  if (value !== 1 && value !== -1 && value !== 0) throw new QaError(400, "BAD_VALUE", "value must be 1, -1 or 0.");
  const r = await prisma.resource.findUnique({ where: { id: resourceId }, select: { id: true } });
  if (!r) throw new QaError(404, "NOT_FOUND", "Resource not found.");
  if (!(await ratableResourceIds(userId)).has(resourceId))
    throw new QaError(403, "MUST_HOLD", "You can rate this once you hold a topic it covers: pass a quiz with no mistakes or answer a question correctly.");
  if (value === 0) await prisma.resourceVote.deleteMany({ where: { userId, resourceId } });
  else
    await prisma.resourceVote.upsert({
      where: { userId_resourceId: { userId, resourceId } },
      update: { value },
      create: { userId, resourceId, value },
    });
}

export type ResourceFeedback = { id: string; title: string; type: string; module: string; up: number; down: number };

/** Totals per resource, for admins. Resources nobody has rated are included with zeros. */
export async function resourceFeedback(): Promise<ResourceFeedback[]> {
  const [resources, groups] = await Promise.all([
    prisma.resource.findMany({ select: { id: true, title: true, type: true, module: { select: { code: true, title: true } } }, orderBy: [{ module: { order: "asc" } }, { order: "asc" }] }),
    prisma.resourceVote.groupBy({ by: ["resourceId", "value"], _count: { _all: true } }),
  ]);
  const tot = new Map<string, { up: number; down: number }>();
  for (const g of groups) {
    const t = tot.get(g.resourceId) ?? { up: 0, down: 0 };
    if (g.value > 0) t.up += g._count._all; else t.down += g._count._all;
    tot.set(g.resourceId, t);
  }
  return resources.map((r) => ({
    id: r.id, title: r.title, type: r.type, module: r.module.code || r.module.title,
    up: tot.get(r.id)?.up ?? 0, down: tot.get(r.id)?.down ?? 0,
  }));
}
