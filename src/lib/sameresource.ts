import { prisma } from "./db";
import { resourceKey } from "./resourcekey";

/**
 * The List places some videos in more than one module (a Day 1 clip and the
 * same talk on the reference shelf). Each placement is its own Resource row,
 * but it is one piece of content: watching it once is watching it everywhere.
 *
 * Identity is the URL. Resources without one (exercises) are only themselves.
 * Returns every resource id that is the same content as `resourceId`, itself
 * included.
 */
export async function sameResourceIds(resourceId: string): Promise<string[]> {
  const r = await prisma.resource.findUnique({ where: { id: resourceId }, select: { url: true } });
  if (!r) return [];
  if (!r.url.trim()) return [resourceId];
  const key = resourceKey(r.url);
  const all = await prisma.resource.findMany({ where: { url: { not: "" } }, select: { id: true, url: true } });
  const ids = all.filter((x) => resourceKey(x.url) === key).map((x) => x.id);
  return ids.includes(resourceId) ? ids : [resourceId, ...ids];
}
