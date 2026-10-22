import { prisma } from "./db";
import { resourceKey } from "./resourcekey";

/**
 * The stable identity of a content row, as the seed knows it: a module's code, a node's
 * slug, an edge's endpoints and kind, a resource's URL within its module. Ids are not
 * stable (a fresh database mints new ones), so anything that has to survive a reseed
 * (admin deletions, conflicts) is recorded against these keys.
 */
export type ContentType = "course" | "section" | "module" | "resource" | "region" | "node" | "edge" | "coverage";

/** The key for a resource inside a module: its URL, or its title when it has none (an exercise). */
export const resourceInModuleKey = (moduleCode: string, url: string, title: string) =>
  `${moduleCode}|${url.trim() ? resourceKey(url) : "t:" + title}`;

export async function contentKey(type: ContentType, id: string): Promise<string | null> {
  switch (type) {
    case "course":
      return (await prisma.course.findUnique({ where: { id }, select: { slug: true } }))?.slug ?? null;
    case "section": {
      const r = await prisma.section.findUnique({ where: { id }, select: { code: true } });
      return r?.code ? r.code : null;
    }
    case "module": {
      const r = await prisma.module.findUnique({ where: { id }, select: { code: true } });
      return r?.code ? r.code : null;
    }
    case "resource": {
      const r = await prisma.resource.findUnique({
        where: { id },
        select: { url: true, title: true, module: { select: { code: true } } },
      });
      return r && r.module.code ? resourceInModuleKey(r.module.code, r.url, r.title) : null;
    }
    case "region":
      return (await prisma.region.findUnique({ where: { id }, select: { slug: true } }))?.slug ?? null;
    case "node":
      return (await prisma.node.findUnique({ where: { id }, select: { slug: true } }))?.slug ?? null;
    case "edge": {
      const r = await prisma.edge.findUnique({
        where: { id },
        select: { kind: true, from: { select: { slug: true } }, to: { select: { slug: true } } },
      });
      return r ? `${r.from.slug}|${r.to.slug}|${r.kind}` : null;
    }
    default:
      return null;
  }
}

const KIND: Partial<Record<ContentType, string>> = {
  course: "COURSE", section: "SECTION", module: "MODULE", resource: "RESOURCE_KEY",
  region: "REGION", node: "NODE", edge: "EDGE",
};
const TOMBSTONE = "DELETED_BY_ADMIN";

/** Record that an admin deleted this row on purpose, so the seed does not bring it back. */
export async function writeTombstone(type: ContentType, key: string, note = ""): Promise<void> {
  const kind = KIND[type];
  if (!kind) return;
  await prisma.contentMapping.upsert({
    where: { kind_fromKey: { kind, fromKey: key } },
    update: { status: TOMBSTONE, toKey: null, note },
    create: { kind, fromKey: key, toKey: null, status: TOMBSTONE, note },
  });
}

/** The admin created the key again: it is wanted, so drop the tombstone. */
export async function clearTombstone(type: ContentType, key: string): Promise<void> {
  const kind = KIND[type];
  if (!kind) return;
  await prisma.contentMapping.deleteMany({ where: { kind, fromKey: key, status: TOMBSTONE } });
}

/** All tombstoned keys of one type. */
export async function tombstones(type: ContentType): Promise<Set<string>> {
  const kind = KIND[type];
  if (!kind) return new Set();
  const rows = await prisma.contentMapping.findMany({ where: { kind, status: TOMBSTONE }, select: { fromKey: true } });
  return new Set(rows.map((r) => r.fromKey));
}
