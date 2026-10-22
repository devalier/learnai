/**
 * The content sync: makes the database match a desired state (the seed) without overwriting
 * what admins and users have done since.
 *
 * Every row the seed manages has `origin = "SEED"` and a `seedSnapshot` of the values it last
 * wrote. On each run, for every field of a managed row, three values are compared:
 *
 *   base    the snapshot (what the seed wrote last time)
 *   current what is in the database now
 *   theirs  what the seed wants now
 *
 *   current == theirs        nothing to do
 *   current == base          nobody touched it: apply theirs
 *   theirs  == base          only an admin changed it: keep the admin's value
 *   all three differ         a clash: the admin's value stays and a ContentConflict is recorded
 *
 * Rows without a snapshot are not the seed's: admin-created rows, community rows, and
 * legacy rows not yet adopted. They are never rewritten or deleted. A row the seed no longer
 * lists is deleted only if it is the seed's, unedited, and has no learner data; with learner
 * data it is retired (hidden, history kept); if an admin edited it, it is detached (kept,
 * now the admin's). Keys an admin deleted on purpose (tombstones) are not recreated.
 *
 * Call inside a transaction. `dry` makes the caller roll back, so the report is exact.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { resourceInModuleKey } from "./contentkeys";
import { resourceKey } from "./resourcekey";

export type Db = Prisma.TransactionClient | PrismaClient;

export type DResource = { type: string; title: string; url?: string; author?: string; durationMin?: number | null; note?: string };
export type DModule = {
  code: string; title: string; topic?: string; timeSlot?: string; duration?: string; summary?: string; body?: string;
  tier?: "CORE" | "OPTIONAL" | "REFERENCE"; resources: DResource[];
};
export type DSection = { code: string; kicker?: string; title: string; subtitle?: string; modules: DModule[] };
export type DRegion = { slug: string; name: string; blurb: string; labelX: number; labelY: number };
export type DNode = {
  slug: string; title: string; summary: string; means: string; wrong: string; defend: string;
  kind: "CONCEPT" | "DECISION" | "CONSTRAINT"; region: string; x: number; y: number;
};
export type DEdge = [from: string, to: string, kind: "REFINES" | "ADJACENT" | "TENSION"];
export type DCoverage = [key: string, slug: string, depth: "DEFINES" | "DEMONSTRATES" | "MENTIONS", note: string, confidence: number, startSec?: number];
export type Desired = {
  course: { slug: string; title: string; subtitle: string; description: string; order: number };
  sections: DSection[];
  regions: DRegion[];
  nodes: DNode[];
  edges: DEdge[];
  coverage: DCoverage[];
};

type Rec = Record<string, unknown>;
export type Report = {
  lines: string[];
  count: Record<string, number>;
  conflicts: number;
  /** rows that match a seed key but belong to an admin or are not adopted */
  protectedKeys: string[];
};

class Ctx {
  report: Report = { lines: [], count: {}, conflicts: 0, protectedKeys: [] };
  constructor(public db: Db, public tomb: Map<string, Set<string>>) {}
  note(kind: string, action: string, key: string, detail = "") {
    const c = `${kind}.${action}`;
    this.report.count[c] = (this.report.count[c] ?? 0) + 1;
    if (action !== "unchanged") this.report.lines.push(`${action.padEnd(10)} ${kind.padEnd(9)} ${key}${detail ? "  " + detail : ""}`);
  }
  dead(kind: string, key: string) {
    return this.tomb.get(kind)?.has(key) ?? false;
  }
}

const norm = (v: unknown): unknown => {
  if (v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  return v;
};
const same = (a: unknown, b: unknown) => {
  const x = norm(a), y = norm(b);
  // Floats lose their last digit on a round trip through the database, so compare them to 1e-9.
  if (typeof x === "number" && typeof y === "number") return Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
  return JSON.stringify(x) === JSON.stringify(y);
};

/** Three-way merge of one row. `desired` lists every field the seed writes. */
export function mergeRow(current: Rec, snapshot: Rec, desired: Rec): {
  update: Rec; snapshot: Rec; conflicts: { field: string; admin: unknown; seed: unknown }[]; adminKept: string[];
} {
  const update: Rec = {};
  const next: Rec = {};
  const conflicts: { field: string; admin: unknown; seed: unknown }[] = [];
  const adminKept: string[] = [];
  for (const f of Object.keys(desired)) {
    const cur = current[f], base = snapshot[f], theirs = desired[f];
    if (same(cur, theirs)) next[f] = norm(theirs);
    else if (same(cur, base)) { update[f] = theirs; next[f] = norm(theirs); }
    else if (same(theirs, base)) { next[f] = norm(base); adminKept.push(f); }
    else { next[f] = norm(base); conflicts.push({ field: f, admin: norm(cur), seed: norm(theirs) }); }
  }
  return { update, snapshot: next, conflicts, adminKept };
}

/** Did the merge change the snapshot in a way that matters? (Textual differences from float round-trips do not.) */
const snapshotChanged = (a: Rec, b: Rec) => Object.keys({ ...a, ...b }).some((f) => !same(a[f], b[f]));

/** Has a managed row been changed from what the seed last wrote? */
const edited = (current: Rec, snapshot: Rec) => Object.keys(snapshot).some((f) => !same(current[f], snapshot[f]));
const pick = (row: Rec, fields: string[]): Rec => Object.fromEntries(fields.map((f) => [f, norm(row[f])]));

async function recordConflicts(c: Ctx, kind: string, key: string, conflicts: { field: string; admin: unknown; seed: unknown }[], resolvedFields: string[]) {
  for (const x of conflicts) {
    c.report.conflicts++;
    c.report.lines.push(`CONFLICT   ${kind.padEnd(9)} ${key}.${x.field}: admin value kept (seed wanted something else)`);
    await c.db.contentConflict.upsert({
      where: { kind_key_field: { kind, key, field: x.field } },
      update: { adminValue: (x.admin ?? null) as Prisma.InputJsonValue, seedValue: (x.seed ?? null) as Prisma.InputJsonValue, status: "OPEN", resolvedAt: null },
      create: { kind, key, field: x.field, adminValue: (x.admin ?? null) as Prisma.InputJsonValue, seedValue: (x.seed ?? null) as Prisma.InputJsonValue },
    });
  }
  if (resolvedFields.length)
    await c.db.contentConflict.updateMany({
      where: { kind, key, field: { in: resolvedFields }, status: "OPEN" },
      data: { status: "KEPT_ADMIN", resolvedAt: new Date() },
    });
}

/** The admin and the seed now agree on these fields, or the seed no longer disagrees: close their conflicts. */
function agreed(current: Rec, desired: Rec, m: ReturnType<typeof mergeRow>): string[] {
  return Object.keys(desired).filter((f) => !m.conflicts.some((x) => x.field === f) && (same(current[f], desired[f]) || m.adminKept.includes(f)));
}

async function loadTombstones(db: Db) {
  const rows = await db.contentMapping.findMany({ where: { status: "DELETED_BY_ADMIN" }, select: { kind: true, fromKey: true } });
  const m = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!m.has(r.kind)) m.set(r.kind, new Set());
    m.get(r.kind)!.add(r.fromKey);
  }
  return m;
}

async function retiredNote(c: Ctx, kind: string, key: string, note: string) {
  await c.db.contentMapping.upsert({
    where: { kind_fromKey: { kind, fromKey: key } },
    update: {},
    create: { kind, fromKey: key, toKey: null, status: "RETIRED", note: note.slice(0, 500) },
  });
}

const COURSE_F = ["title", "subtitle", "description", "order"];
const SECTION_F = ["kicker", "title", "subtitle", "order"];
const MODULE_F = ["sectionId", "title", "topic", "timeSlot", "duration", "summary", "body", "order", "retiredAt"];
const RESOURCE_F = ["moduleId", "type", "title", "url", "author", "durationMin", "note", "order", "retiredAt"];
const REGION_F = ["name", "blurb", "labelX", "labelY", "order"];
const NODE_F = ["title", "summary", "whatItMeans", "commonlyWrong", "howToDefend", "kind", "regionId", "x", "y", "order", "retiredAt"];

type Managed = { id: string; origin: string; seedSnapshot: unknown } & Rec;
const snap = (r: Managed): Rec | null => (r.seedSnapshot && typeof r.seedSnapshot === "object" ? (r.seedSnapshot as Rec) : null);
const managed = (r: Managed) => r.origin === "SEED" && snap(r) !== null;

/**
 * Keys the seed manages that exist in the database but were never adopted (no snapshot):
 * what a database built before content ownership looks like. The sync refuses to run until
 * `npm run content:adopt` has recorded them, because it could not tell the seed's rows from
 * an admin's.
 */
export async function adoptionNeeded(db: Db, d: Desired): Promise<string[]> {
  const codes = d.sections.flatMap((s) => s.modules.map((m) => m.code));
  const [mods, nodes, secs] = await Promise.all([
    db.module.findMany({ where: { code: { in: codes }, seedSnapshot: { equals: Prisma.DbNull } }, select: { code: true } }),
    db.node.findMany({ where: { slug: { in: d.nodes.map((n) => n.slug) }, origin: "SEED", seedSnapshot: { equals: Prisma.DbNull } }, select: { slug: true } }),
    db.section.findMany({ where: { code: "" }, select: { title: true } }),
  ]);
  return [...mods.map((m) => `module ${m.code}`), ...nodes.map((n) => `node ${n.slug}`), ...secs.map((x) => `section "${x.title}" has no code`)];
}

export async function syncContent(db: Db, d: Desired): Promise<Report> {
  const c = new Ctx(db, await loadTombstones(db));
  const now = new Date();

  // ── Course ────────────────────────────────────────────────────────────────
  const courseDesired: Rec = { title: d.course.title, subtitle: d.course.subtitle, description: d.course.description, order: d.course.order };
  let course = (await db.course.findUnique({ where: { slug: d.course.slug } })) as Managed | null;
  if (!course) {
    course = (await db.course.create({ data: { slug: d.course.slug, ...courseDesired, origin: "SEED", seedSnapshot: courseDesired as Prisma.InputJsonValue } as never })) as unknown as Managed;
    c.note("course", "created", d.course.slug);
  } else if (!managed(course)) {
    c.note("course", "protected", d.course.slug, "(admin-owned or not adopted)");
    c.report.protectedKeys.push(`course ${d.course.slug}`);
  } else {
    const m = mergeRow(course, snap(course)!, courseDesired);
    if (Object.keys(m.update).length || snapshotChanged(m.snapshot, snap(course)!)) {
      await db.course.update({ where: { id: course.id }, data: { ...(m.update as object), seedSnapshot: m.snapshot as Prisma.InputJsonValue } });
      c.note("course", Object.keys(m.update).length ? "updated" : "kept", d.course.slug, m.adminKept.length ? `admin kept: ${m.adminKept.join(",")}` : "");
    }
    await recordConflicts(c, "course", d.course.slug, m.conflicts, agreed(course, courseDesired, m));
  }
  const courseId = course.id;

  // ── Sections and modules ──────────────────────────────────────────────────
  const keptSections = new Set<string>();
  const keptModuleCodes = new Set<string>();
  const sectionIdByCode = new Map<string, string>();

  for (const [si, s] of d.sections.entries()) {
    keptSections.add(s.code);
    if (c.dead("SECTION", s.code)) { c.note("section", "tombstone", s.code, "(deleted by an admin; not recreated)"); continue; }
    const desired: Rec = { kicker: s.kicker ?? "", title: s.title, subtitle: s.subtitle ?? "", order: si };
    let sec = (await db.section.findFirst({ where: { courseId, code: s.code } })) as Managed | null;
    if (!sec) {
      sec = (await db.section.create({ data: { courseId, code: s.code, ...desired, origin: "SEED", seedSnapshot: desired as Prisma.InputJsonValue } as never })) as unknown as Managed;
      c.note("section", "created", s.code);
    } else if (!managed(sec)) {
      c.note("section", "protected", s.code);
      c.report.protectedKeys.push(`section ${s.code}`);
    } else {
      const m = mergeRow(sec, snap(sec)!, desired);
      if (Object.keys(m.update).length || snapshotChanged(m.snapshot, snap(sec)!)) {
        await db.section.update({ where: { id: sec.id }, data: { ...(m.update as object), seedSnapshot: m.snapshot as Prisma.InputJsonValue } });
        c.note("section", Object.keys(m.update).length ? "updated" : "kept", s.code, m.adminKept.length ? `admin kept: ${m.adminKept.join(",")}` : "");
      }
      await recordConflicts(c, "section", s.code, m.conflicts, agreed(sec, desired, m));
    }
    sectionIdByCode.set(s.code, sec.id);

    for (const [mi, m0] of s.modules.entries()) {
      keptModuleCodes.add(m0.code);
      if (c.dead("MODULE", m0.code)) { c.note("module", "tombstone", m0.code, "(deleted by an admin; not recreated)"); continue; }
      const mdesired: Rec = {
        sectionId: sec.id, title: m0.title, topic: m0.topic ?? "", timeSlot: m0.timeSlot ?? "", duration: m0.duration ?? "",
        summary: m0.summary ?? "", body: m0.body ?? "", order: mi, retiredAt: null,
      };
      if (m0.tier) mdesired.tier = m0.tier;
      let mod = (await db.module.findFirst({ where: { code: m0.code, section: { courseId } } })) as Managed | null;
      if (!mod) {
        mod = (await db.module.create({ data: { code: m0.code, ...mdesired, origin: "SEED", seedSnapshot: mdesired as Prisma.InputJsonValue } as never })) as unknown as Managed;
        c.note("module", "created", m0.code);
      } else if (!managed(mod)) {
        c.note("module", "protected", m0.code, "(admin-owned or not adopted; seed changes skipped)");
        c.report.protectedKeys.push(`module ${m0.code}`);
        continue; // its resources are the admin's to manage too
      } else {
        const mm = mergeRow(mod, snap(mod)!, mdesired);
        if (Object.keys(mm.update).length || snapshotChanged(mm.snapshot, snap(mod)!)) {
          await db.module.update({ where: { id: mod.id }, data: { ...(mm.update as object), seedSnapshot: mm.snapshot as Prisma.InputJsonValue } as never });
          c.note("module", Object.keys(mm.update).length ? "updated" : "kept", m0.code, mm.adminKept.length ? `admin kept: ${mm.adminKept.join(",")}` : "");
        }
        await recordConflicts(c, "module", m0.code, mm.conflicts, agreed(mod, mdesired, mm));
      }
      await syncResources(c, mod, m0);
    }
  }

  // Modules the seed no longer lists.
  const gone = (await db.module.findMany({ where: { section: { courseId }, code: { notIn: [...keptModuleCodes] }, origin: "SEED" } })) as unknown as Managed[];
  for (const mod of gone) {
    const sn = snap(mod);
    if (!sn) continue;
    const code = String(mod.code);
    const progress = await db.progress.count({ where: { moduleId: mod.id } });
    const resourceProgress = await db.progress.count({ where: { resource: { moduleId: mod.id } } });
    const adminKids = await db.resource.count({ where: { moduleId: mod.id, origin: { not: "SEED" } } });
    if (progress + resourceProgress > 0 && !mod.retiredAt) {
      const iso = now.toISOString();
      await db.module.update({ where: { id: mod.id }, data: { retiredAt: now, seedSnapshot: { ...sn, retiredAt: iso } as Prisma.InputJsonValue } });
      await retiredNote(c, "MODULE", code, String(mod.title));
      c.note("module", "retired", code, `(${progress + resourceProgress} progress row(s) kept)`);
    } else if (progress + resourceProgress > 0) {
      c.note("module", "unchanged", code);
    } else if (edited(mod, sn) || adminKids > 0) {
      await db.module.update({ where: { id: mod.id }, data: { origin: "ADMIN", seedSnapshot: Prisma.DbNull as never } });
      c.note("module", "detached", code, "(edited by an admin; kept as theirs)");
    } else {
      await db.module.delete({ where: { id: mod.id } });
      await retiredNote(c, "MODULE", code, String(mod.title));
      c.note("module", "deleted", code);
    }
  }

  // Sections the seed no longer lists: removed only when empty and untouched.
  for (const sec of (await db.section.findMany({ where: { courseId, origin: "SEED", code: { notIn: [...keptSections] } } })) as unknown as Managed[]) {
    const sn = snap(sec);
    if (!sn) continue;
    const kids = await db.module.count({ where: { sectionId: sec.id } });
    if (kids === 0 && !edited(sec, sn)) { await db.section.delete({ where: { id: sec.id } }); c.note("section", "deleted", String(sec.code)); }
    else { await db.section.update({ where: { id: sec.id }, data: { origin: "ADMIN", seedSnapshot: Prisma.DbNull as never } }); c.note("section", "detached", String(sec.code)); }
  }

  await syncGraph(c, d);
  return c.report;
}

async function syncResources(c: Ctx, mod: Managed, m0: DModule) {
  const db = c.db;
  const code = String(mod.code);
  const existing = (await db.resource.findMany({ where: { moduleId: mod.id }, orderBy: { order: "asc" } })) as unknown as Managed[];
  const claimed = new Set<string>();
  const seedRows = existing.filter(managed);
  const urlless = seedRows.filter((e) => !String(e.url).trim());
  let nextUrlless = 0;
  for (const [ri, r] of m0.resources.entries()) {
    const key = resourceInModuleKey(code, r.url ?? "", r.title);
    if (c.dead("RESOURCE_KEY", key)) { c.note("resource", "tombstone", key, "(deleted by an admin; not recreated)"); continue; }
    const desired: Rec = {
      moduleId: mod.id, type: r.type, title: r.title, url: r.url ?? "", author: r.author ?? "",
      durationMin: r.durationMin ?? null, note: r.note ?? "", order: ri, retiredAt: null,
    };
    const match = r.url?.trim()
      ? seedRows.find((e) => !claimed.has(e.id) && String(e.url).trim() && resourceKey(String(e.url)) === resourceKey(r.url!))
      : urlless[nextUrlless++];
    if (!match || claimed.has(match.id)) {
      // An admin resource with the same URL already sits in the module: leave it alone.
      const theirs = existing.find((e) => !managed(e) && r.url?.trim() && String(e.url).trim() && resourceKey(String(e.url)) === resourceKey(r.url));
      if (theirs) { c.note("resource", "protected", key, "(an admin already added this)"); c.report.protectedKeys.push(`resource ${key}`); continue; }
      await db.resource.create({ data: { ...desired, origin: "SEED", seedSnapshot: desired as Prisma.InputJsonValue } as never });
      c.note("resource", "created", key);
      continue;
    }
    claimed.add(match.id);
    const m = mergeRow(match, snap(match)!, desired);
    if (Object.keys(m.update).length || snapshotChanged(m.snapshot, snap(match)!)) {
      await db.resource.update({ where: { id: match.id }, data: { ...(m.update as object), seedSnapshot: m.snapshot as Prisma.InputJsonValue } as never });
      c.note("resource", Object.keys(m.update).length ? "updated" : "kept", key, m.adminKept.length ? `admin kept: ${m.adminKept.join(",")}` : "");
    }
    await recordConflicts(c, "resource", key, m.conflicts, agreed(match, desired, m));
  }
  // The seed's own resources that are no longer listed.
  for (const e of seedRows.filter((x) => !claimed.has(x.id))) {
    const sn = snap(e)!;
    const key = resourceInModuleKey(code, String(e.url), String(e.title));
    const ticks = await db.progress.count({ where: { resourceId: e.id } });
    if (ticks > 0) {
      if (!e.retiredAt) {
        const now = new Date();
        await db.resource.update({ where: { id: e.id }, data: { retiredAt: now, seedSnapshot: { ...sn, retiredAt: now.toISOString() } as Prisma.InputJsonValue } });
        await retiredNote(c, "RESOURCE", e.id, `${e.title} · ${e.url}`);
        c.note("resource", "retired", key, `(${ticks} tick(s) kept)`);
      }
    } else if (edited(e, sn)) {
      await db.resource.update({ where: { id: e.id }, data: { origin: "ADMIN", seedSnapshot: Prisma.DbNull as never } });
      c.note("resource", "detached", key, "(edited by an admin; kept as theirs)");
    } else {
      await db.resource.delete({ where: { id: e.id } });
      await retiredNote(c, "RESOURCE", e.id, `${e.title} · ${e.url}`);
      c.note("resource", "deleted", key);
    }
  }
}

async function syncGraph(c: Ctx, d: Desired) {
  const db = c.db;

  // Regions
  const regionId = new Map<string, string>();
  for (const [i, r] of d.regions.entries()) {
    if (c.dead("REGION", r.slug)) { c.note("region", "tombstone", r.slug); continue; }
    const desired: Rec = { name: r.name, blurb: r.blurb, labelX: r.labelX, labelY: r.labelY, order: i };
    const row = (await db.region.findUnique({ where: { slug: r.slug } })) as Managed | null;
    if (!row) {
      const made = await db.region.create({ data: { slug: r.slug, ...desired, origin: "SEED", seedSnapshot: desired as Prisma.InputJsonValue } as never });
      regionId.set(r.slug, made.id);
      c.note("region", "created", r.slug);
    } else if (!managed(row)) {
      regionId.set(r.slug, row.id);
      c.note("region", "protected", r.slug);
      c.report.protectedKeys.push(`region ${r.slug}`);
    } else {
      regionId.set(r.slug, row.id);
      const m = mergeRow(row, snap(row)!, desired);
      if (Object.keys(m.update).length || snapshotChanged(m.snapshot, snap(row)!)) {
        await db.region.update({ where: { id: row.id }, data: { ...(m.update as object), seedSnapshot: m.snapshot as Prisma.InputJsonValue } as never });
        c.note("region", Object.keys(m.update).length ? "updated" : "kept", r.slug, m.adminKept.length ? `admin kept: ${m.adminKept.join(",")}` : "");
      }
      await recordConflicts(c, "region", r.slug, m.conflicts, agreed(row, desired, m));
    }
  }

  // Nodes
  const nodeId = new Map<string, string>();
  for (const [i, n] of d.nodes.entries()) {
    if (c.dead("NODE", n.slug)) { c.note("node", "tombstone", n.slug); continue; }
    const desired: Rec = {
      title: n.title, summary: n.summary, whatItMeans: n.means, commonlyWrong: n.wrong, howToDefend: n.defend, kind: n.kind,
      regionId: regionId.get(n.region) ?? null, x: n.x, y: n.y, order: i, retiredAt: null,
    };
    const row = (await db.node.findUnique({ where: { slug: n.slug } })) as Managed | null;
    if (!row) {
      const made = await db.node.create({ data: { slug: n.slug, ...desired, origin: "SEED", seedSnapshot: desired as Prisma.InputJsonValue } as never });
      nodeId.set(n.slug, made.id);
      c.note("node", "created", n.slug);
    } else if (row.origin === "COMMUNITY") {
      // A community-added node whose name is adopted into the vocabulary becomes a curated node.
      await db.node.update({ where: { id: row.id }, data: { ...desired, origin: "SEED", seedSnapshot: desired as Prisma.InputJsonValue } as never });
      nodeId.set(n.slug, row.id);
      c.note("node", "adopted", n.slug, "(community node taken into the vocabulary)");
    } else if (!managed(row)) {
      nodeId.set(n.slug, row.id);
      c.note("node", "protected", n.slug, "(admin-owned or not adopted)");
      c.report.protectedKeys.push(`node ${n.slug}`);
    } else {
      nodeId.set(n.slug, row.id);
      const m = mergeRow(row, snap(row)!, desired);
      if (Object.keys(m.update).length || snapshotChanged(m.snapshot, snap(row)!)) {
        await db.node.update({ where: { id: row.id }, data: { ...(m.update as object), seedSnapshot: m.snapshot as Prisma.InputJsonValue } as never });
        c.note("node", Object.keys(m.update).length ? "updated" : "kept", n.slug, m.adminKept.length ? `admin kept: ${m.adminKept.join(",")}` : "");
      }
      await recordConflicts(c, "node", n.slug, m.conflicts, agreed(row, desired, m));
    }
  }

  // Nodes the vocabulary no longer lists are retired, never deleted: holdings, claims and positions survive.
  const keptSlugs = d.nodes.map((n) => n.slug);
  const dropped = (await db.node.findMany({ where: { slug: { notIn: keptSlugs }, retiredAt: null, origin: "SEED" } })) as unknown as Managed[];
  for (const n of dropped) {
    const sn = snap(n);
    if (!sn) continue; // not adopted: leave it
    const now = new Date();
    await db.node.update({ where: { id: n.id }, data: { retiredAt: now, regionId: null, seedSnapshot: { ...sn, retiredAt: now.toISOString(), regionId: null } as Prisma.InputJsonValue } });
    c.note("node", "retired", String(n.slug));
  }

  // Regions the vocabulary no longer lists: removed only if empty and untouched.
  for (const r of (await db.region.findMany({ where: { origin: "SEED", slug: { notIn: d.regions.map((x) => x.slug) } } })) as unknown as Managed[]) {
    const sn = snap(r);
    if (!sn) continue;
    const members = await db.node.count({ where: { regionId: r.id } });
    if (members === 0 && !edited(r, sn)) { await db.region.delete({ where: { id: r.id } }); c.note("region", "deleted", String(r.slug)); }
    else { await db.region.update({ where: { id: r.id }, data: { origin: "ADMIN", seedSnapshot: Prisma.DbNull as never } }); c.note("region", "detached", String(r.slug)); }
  }

  // Edges
  const wanted = new Set(d.edges.map(([f, t, k]) => `${f}|${t}|${k}`));
  const have = await db.edge.findMany({ include: { from: { select: { slug: true } }, to: { select: { slug: true } } } });
  const haveKeys = new Map(have.map((e) => [`${e.from.slug}|${e.to.slug}|${e.kind}`, e]));
  for (const [e, row] of haveKeys) {
    if (wanted.has(e) || row.origin !== "SEED") continue;
    const sn = snap(row as unknown as Managed);
    if (!sn) continue;
    if (!edited(row as unknown as Rec, sn)) { await db.edge.delete({ where: { id: row.id } }); c.note("edge", "deleted", e); }
    else { await db.edge.update({ where: { id: row.id }, data: { origin: "ADMIN", seedSnapshot: Prisma.DbNull as never } }); c.note("edge", "detached", e); }
  }
  for (const [f, t, k] of d.edges) {
    const key = `${f}|${t}|${k}`;
    if (c.dead("EDGE", key)) { c.note("edge", "tombstone", key); continue; }
    const fromId = nodeId.get(f), toId = nodeId.get(t);
    if (!fromId || !toId) {
      if (c.dead("NODE", f) || c.dead("NODE", t)) continue;
      throw new Error(`Edge references an unknown node: ${f} -> ${t}`);
    }
    const row = haveKeys.get(key);
    if (!row) {
      await db.edge.create({ data: { fromId, toId, kind: k, origin: "SEED", seedSnapshot: { weight: 1 } } });
      c.note("edge", "created", key);
    } else if (row.origin === "SEED" && snap(row as unknown as Managed)) {
      const sn = snap(row as unknown as Managed)!;
      const m = mergeRow(row as unknown as Rec, sn, { weight: 1 });
      if (Object.keys(m.update).length) await db.edge.update({ where: { id: row.id }, data: { ...(m.update as object), seedSnapshot: m.snapshot as Prisma.InputJsonValue } as never });
      await recordConflicts(c, "edge", key, m.conflicts, agreed(row as unknown as Rec, { weight: 1 }, m));
    }
  }

  await syncCoverage(c, d, nodeId);
}

async function syncCoverage(c: Ctx, d: Desired, nodeId: Map<string, string>) {
  const db = c.db;
  // The seed owns only its own coverage rows (source SEED). HUMAN and MACHINE rows are left alone.
  const before = await db.coverage.count({ where: { source: "SEED" } });
  await db.coverage.deleteMany({ where: { source: "SEED" } });
  const all = await db.resource.findMany({ where: { retiredAt: null }, select: { id: true, url: true, title: true } });
  const copies = (key: string) =>
    all.filter((r) => (r.url.trim() ? resourceKey(r.url) === resourceKey(key) : r.title === key)).map((r) => r.id);
  let created = 0;
  const missing = new Set<string>();
  for (const [i, [key, slug, depth, note, confidence, startSec]] of d.coverage.entries()) {
    const nid = nodeId.get(slug);
    if (!nid) {
      if (c.dead("NODE", slug)) continue;
      const existing = await db.node.findUnique({ where: { slug }, select: { id: true } });
      if (!existing) throw new Error(`Coverage references an unknown node: ${slug}`);
      continue;
    }
    const ids = copies(key);
    if (!ids.length) { missing.add(key); continue; }
    for (const resourceId of ids) {
      const exists = await db.coverage.findUnique({ where: { nodeId_resourceId: { nodeId: nid, resourceId } }, select: { id: true } });
      if (exists) continue; // a HUMAN or MACHINE row for this pair outranks the seed
      await db.coverage.create({ data: { nodeId: nid, resourceId, depth, evidence: note, startSec: startSec ?? null, source: "SEED", confidence, order: i } });
      created++;
    }
  }
  c.report.count["coverage.rebuilt"] = created;
  c.report.lines.push(`coverage   SEED rows: ${before} -> ${created}${missing.size ? `; no matching resource for ${missing.size} key(s)` : ""}`);
  if (missing.size) c.report.lines.push(...[...missing].map((k) => `  coverage skipped, no resource: ${k}`));
}
