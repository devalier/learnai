/**
 * Read-only reconciliation report for a content refactor. Run it against a staging copy
 * before and after a migration and diff the output.
 *
 *   npx tsx scripts/content-report.ts                 # report only
 *   npx tsx scripts/content-report.ts --tiers t.json  # also show what a tier plan would change
 *   npx tsx scripts/content-report.ts --tiers t.json --apply   # write the tiers (and nothing else)
 *
 * t.json maps module code -> "CORE" | "OPTIONAL" | "REFERENCE". Tier changes never touch
 * Progress, and --apply is the only write this script has. Duplicate resources are reported,
 * not merged: a Resource belongs to one module, so merging rows would remove it from a module.
 * The App already treats same-URL placements as one item (src/lib/sameresource.ts).
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { resourceKey } from "../src/lib/resourcekey";

const TIERS = new Set(["CORE", "OPTIONAL", "REFERENCE"]);
const args = process.argv.slice(2);
const flag = (n: string) => args.indexOf(n);
const tiersFile = flag("--tiers") >= 0 ? args[flag("--tiers") + 1] : null;
const apply = flag("--apply") >= 0;

async function main() {
  const db = new PrismaClient();
  try {
    const [users, modules, resources, progress, holdings, nodes, mappings] = await Promise.all([
      db.user.count(), db.module.findMany({ select: { id: true, code: true, tier: true, _count: { select: { progress: true } } } }),
      db.resource.findMany({ select: { id: true, url: true, moduleId: true, _count: { select: { coverage: true, progress: true, votes: true } } } }),
      db.progress.groupBy({ by: ["basis", "completed"], _count: { _all: true } }),
      db.holding.count(), db.node.count({ where: { retiredAt: null } }), db.contentMapping.count(),
    ]);

    console.log(`users ${users} · modules ${modules.length} · resources ${resources.length} · live nodes ${nodes} · holdings ${holdings} · mappings ${mappings}`);
    console.log("progress by basis/completed:", JSON.stringify(progress.map((p) => ({ basis: p.basis, completed: p.completed, n: p._count._all }))));
    const tierCount: Record<string, number> = {};
    for (const m of modules) tierCount[m.tier] = (tierCount[m.tier] ?? 0) + 1;
    console.log("modules by tier:", JSON.stringify(tierCount));

    const byKey = new Map<string, string[]>();
    for (const r of resources) if (r.url.trim()) byKey.set(resourceKey(r.url), [...(byKey.get(resourceKey(r.url)) ?? []), r.id]);
    const dups = [...byKey.entries()].filter(([, ids]) => ids.length > 1);
    console.log(`duplicate-URL resource groups: ${dups.length} (${dups.reduce((n, [, ids]) => n + ids.length, 0)} rows)`);
    const orphans = resources.filter((r) => r._count.coverage === 0 && r.url.trim());
    console.log(`resources with a URL but no node coverage: ${orphans.length}`);
    const legacy = progress.filter((p) => p.basis !== "LEGACY_SELF_REPORTED" && p.basis !== "SELF_REPORTED");
    if (legacy.length) console.log("WARNING: unexpected progress basis values:", JSON.stringify(legacy));

    if (tiersFile) {
      const plan = JSON.parse(readFileSync(tiersFile, "utf8")) as Record<string, string>;
      const byCode = new Map(modules.map((m) => [m.code, m]));
      const bad = Object.entries(plan).filter(([c, t]) => !byCode.has(c) || !TIERS.has(t));
      if (bad.length) { console.log("ERROR: unknown module code or tier:", JSON.stringify(bad)); process.exitCode = 1; return; }
      const changes = Object.entries(plan).filter(([c, t]) => byCode.get(c)!.tier !== t);
      for (const [c, t] of changes) console.log(`tier ${c}: ${byCode.get(c)!.tier} -> ${t} (${byCode.get(c)!._count.progress} progress rows kept)`);
      if (apply) {
        await db.$transaction(changes.map(([c, t]) => db.module.updateMany({ where: { code: c }, data: { tier: t } })));
        console.log(`applied ${changes.length} tier change(s)`);
      } else console.log(`dry run: ${changes.length} change(s) not applied (pass --apply)`);
    }
  } finally {
    await db.$disconnect();
  }
}
main();
