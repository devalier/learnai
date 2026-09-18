import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Open a new claim on a node. Claims are never resolved by the platform. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { nodeId, text } = await req.json();
  const cleanText = String(text ?? "").trim().slice(0, 2000);
  if (!nodeId || !cleanText)
    return NextResponse.json({ error: "nodeId and text required" }, { status: 400 });

  const node = await prisma.node.findUnique({ where: { id: nodeId }, select: { id: true } });
  if (!node) return NextResponse.json({ error: "node not found" }, { status: 404 });

  const claim = await prisma.claim.create({
    data: { nodeId, text: cleanText, openedById: session.sub },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: claim.id });
}
