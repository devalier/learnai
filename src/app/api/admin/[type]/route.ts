import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { readBody } from "@/lib/body";

type Type =
  | "course" | "section" | "module" | "resource"
  | "region" | "node" | "edge" | "coverage";

const FIELDS: Record<Type, string[]> = {
  course: ["slug", "title", "subtitle", "description", "order"],
  section: ["courseId", "kicker", "title", "subtitle", "order"],
  module: ["sectionId", "code", "title", "topic", "timeSlot", "duration", "summary", "body", "order"],
  resource: ["moduleId", "type", "title", "url", "author", "durationMin", "note", "order"],
  region: ["slug", "name", "blurb", "labelX", "labelY", "order"],
  node: ["slug", "title", "summary", "whatItMeans", "commonlyWrong", "howToDefend", "kind", "regionId", "contentVersion", "material", "x", "y", "order"],
  edge: ["fromId", "toId", "kind", "weight"],
  coverage: ["nodeId", "resourceId", "depth", "evidence", "startSec", "source", "confidence", "reviewedAt", "order"],
};

// A single required parent FK per type (enforced on create, stripped on update).
const PARENT: Partial<Record<Type, string>> = {
  section: "courseId",
  module: "sectionId",
  resource: "moduleId",
  coverage: "nodeId",
};

const FLOAT_FIELDS = new Set(["labelX", "labelY", "x", "y", "weight"]);
const INT_FIELDS = new Set(["order", "contentVersion"]);
const BOOL_FIELDS = new Set(["material"]);
const SLUG_TYPES = new Set<Type>(["course", "region", "node"]);
// Field that must be present to create a row (null = none required beyond parent).
const NAME_FIELD: Record<Type, string | null> = {
  course: null, section: "title", module: "title", resource: "title",
  region: "name", node: "title", edge: null, coverage: "evidence",
};

const ADMIN_BODY = 512 * 1024;
class BadField extends Error {}
// Admin text can be long (a module body is a page of Markdown); everything else is a label or a link.
const LONG_TEXT = new Set(["description", "summary", "whatItMeans", "commonlyWrong", "howToDefend", "evidence", "note", "blurb"]);
const capFor = (f: string) => (f === "body" ? 100_000 : LONG_TEXT.has(f) ? 20_000 : f === "url" ? 2_000 : 500);

function pick(type: Type, src: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS[type]) {
    if (src[f] === undefined) continue;
    if (f === "durationMin") out[f] = src[f] === null || src[f] === "" ? null : Number(src[f]);
    else if (FLOAT_FIELDS.has(f)) out[f] = Number(src[f]) || 0;
    else if (INT_FIELDS.has(f)) out[f] = Number(src[f]) || (f === "contentVersion" ? 1 : 0);
    else if (BOOL_FIELDS.has(f)) out[f] = src[f] === true || src[f] === "true" || src[f] === "on";
    else {
      // A string, a finite number or null. Never an object or array, which Prisma would reject as a 500.
      const v = src[f];
      if (v !== null && typeof v !== "string" && typeof v !== "number") throw new BadField(f);
      if (typeof v === "number" && !Number.isFinite(v)) throw new BadField(f);
      if (typeof v === "string" && v.length > capFor(f)) throw new BadField(f);
      out[f] = v;
    }
  }
  return out;
}

function isType(t: string): t is Type {
  return (
    t === "course" || t === "section" || t === "module" || t === "resource" ||
    t === "region" || t === "node" || t === "edge" || t === "coverage"
  );
}

function slugify(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function guard() {
  try {
    await requireAdmin();
    return null;
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
}

const model = (type: Type) =>
  (prisma as unknown as Record<Type, {
    create: (a: unknown) => Promise<unknown>;
    update: (a: unknown) => Promise<unknown>;
    delete: (a: unknown) => Promise<unknown>;
  }>)[type];

export async function POST(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const denied = await guard();
  if (denied) return denied;
  const { type } = await ctx.params;
  if (!isType(type)) return NextResponse.json({ error: "bad type" }, { status: 400 });

  const parsed = await readBody(req, ADMIN_BODY);
  if ("res" in parsed) return parsed.res;
  const body = parsed.body;
  let data: Record<string, unknown>;
  try {
    data = pick(type, body);
  } catch (e) {
    if (e instanceof BadField) return NextResponse.json({ error: `bad value for ${e.message}` }, { status: 400 });
    throw e;
  }

  const parent = PARENT[type];
  if (parent && !data[parent])
    return NextResponse.json({ error: `${parent} required` }, { status: 400 });
  if (type === "edge" && (!data.fromId || !data.toId))
    return NextResponse.json({ error: "fromId and toId required" }, { status: 400 });

  const nameField = NAME_FIELD[type];
  if (nameField && !data[nameField])
    return NextResponse.json({ error: `${nameField} required` }, { status: 400 });

  // Auto-slug for slugged types when none supplied.
  if (SLUG_TYPES.has(type) && !data.slug) {
    const base = slugify(String(data.title || data.name || type)) || type;
    data.slug = `${base}-${Date.now().toString(36)}`;
  }

  try {
    const created = await model(type).create({ data });
    return NextResponse.json({ ok: true, item: created });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "create failed (duplicate slug or edge?)" }, { status: 400 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const denied = await guard();
  if (denied) return denied;
  const { type } = await ctx.params;
  if (!isType(type)) return NextResponse.json({ error: "bad type" }, { status: 400 });

  const parsed = await readBody(req, ADMIN_BODY);
  if ("res" in parsed) return parsed.res;
  const body = parsed.body;
  const id = body.id;
  if (typeof id !== "string" || !id || id.length > 64) return NextResponse.json({ error: "id required" }, { status: 400 });
  let data: Record<string, unknown>;
  try {
    data = pick(type, body);
  } catch (e) {
    if (e instanceof BadField) return NextResponse.json({ error: `bad value for ${e.message}` }, { status: 400 });
    throw e;
  }
  // Immutable parent/endpoint FKs are never changed via update.
  for (const k of ["courseId", "sectionId", "moduleId", "nodeId", "fromId", "toId"]) {
    delete (data as Record<string, unknown>)[k];
  }

  try {
    const updated = await model(type).update({ where: { id }, data });
    return NextResponse.json({ ok: true, item: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "update failed" }, { status: 400 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const denied = await guard();
  if (denied) return denied;
  const { type } = await ctx.params;
  if (!isType(type)) return NextResponse.json({ error: "bad type" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await model(type).delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "delete failed" }, { status: 400 });
  }
}
