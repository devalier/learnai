import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

type Type = "course" | "section" | "module" | "resource";

const FIELDS: Record<Type, string[]> = {
  course: ["slug", "title", "subtitle", "description", "order"],
  section: ["courseId", "kicker", "title", "subtitle", "order"],
  module: ["sectionId", "code", "title", "stanfordWeek", "timeSlot", "duration", "summary", "body", "order"],
  resource: ["moduleId", "type", "title", "url", "author", "durationMin", "note", "order"],
};

const PARENT: Partial<Record<Type, string>> = {
  section: "courseId",
  module: "sectionId",
  resource: "moduleId",
};

function pick(type: Type, src: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS[type]) {
    if (src[f] === undefined) continue;
    if (f === "order") out[f] = Number(src[f]) || 0;
    else if (f === "durationMin") out[f] = src[f] === null || src[f] === "" ? null : Number(src[f]);
    else out[f] = src[f];
  }
  return out;
}

function isType(t: string): t is Type {
  return t === "course" || t === "section" || t === "module" || t === "resource";
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

  const body = await req.json();
  const data = pick(type, body);
  const parent = PARENT[type];
  if (parent && !data[parent])
    return NextResponse.json({ error: `${parent} required` }, { status: 400 });
  if (!data.title && type !== "course") return NextResponse.json({ error: "title required" }, { status: 400 });

  if (type === "course" && !data.slug) {
    data.slug = String(data.title || "course")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString(36);
  }

  try {
    const created = await model(type).create({ data });
    return NextResponse.json({ ok: true, item: created });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "create failed (duplicate slug?)" }, { status: 400 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const denied = await guard();
  if (denied) return denied;
  const { type } = await ctx.params;
  if (!isType(type)) return NextResponse.json({ error: "bad type" }, { status: 400 });

  const body = await req.json();
  const id = body.id;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const data = pick(type, body);
  delete (data as Record<string, unknown>).courseId;
  delete (data as Record<string, unknown>).sectionId;
  delete (data as Record<string, unknown>).moduleId;

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
