import { prisma } from "./db";
import { isSchemaOutOfDate } from "./db";

export type MappingKind = "MODULE" | "NODE" | "RESOURCE";

/**
 * Where an old key now lives. Follows RENAMED/MERGED chains (bounded, so a cycle in the
 * table cannot loop) and returns null when the key was never mapped or was retired with
 * no successor. A missing table (code ahead of the schema) reads as "no mapping".
 */
export async function resolveMapping(kind: MappingKind, key: string): Promise<string | null> {
  let current = key;
  try {
    for (let i = 0; i < 5; i++) {
      const row = await prisma.contentMapping.findUnique({ where: { kind_fromKey: { kind, fromKey: current } } });
      if (!row?.toKey) return current === key ? null : current;
      current = row.toKey;
    }
  } catch (err) {
    if (!isSchemaOutOfDate(err)) throw err;
    return null;
  }
  return current;
}
