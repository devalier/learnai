import { prisma } from "./db";
import type { HoldingState } from "@prisma/client";

/**
 * Holdings engine (Lattice M3).
 *
 * A holding is a user's relation to a node: held or thin. Frontier is never
 * stored — it is derived on read as the one-edge neighbours of the user's held
 * nodes, minus anything they already hold (held or thin).
 *
 * In this phase holdings are seeded from The List's ticks as `provisional`
 * holds, via Coverage: ticking a resource provisionally holds the nodes that
 * resource DEFINES or DEMONSTRATES. A node a resource merely MENTIONS is never
 * held, which is the whole point — watching an eight-minute orientation must
 * not hand you ground on supervised learning.
 *
 * When the session runtime (M4) lands, a node becomes non-provisionally held by
 * closing a defended session; until then a tick is the honest signal we have.
 */

/** Weeks of no session/review touching a held node before it decays to thin. */
export const DECAY_WEEKS = 12;
const DECAY_MS = DECAY_WEEKS * 7 * 24 * 60 * 60 * 1000;

export type PositionNode = {
  id: string;
  slug: string;
  title: string;
  regionId: string | null;
  thinCause?: string;
};

export type Position = {
  held: PositionNode[];
  frontier: PositionNode[];
  thin: PositionNode[];
  counters: { held: number; frontier: number; thin: number };
};

/** Coverage depths that are strong enough to provisionally hold a node. */
const HOLDING_DEPTHS = ["DEFINES", "DEMONSTRATES"] as const;

/**
 * The set of nodes a user has provisionally earned from their current ticks:
 * the union of nodes DEFINED or DEMONSTRATED by every resource they have
 * completed, plus every resource of every module they have completed.
 */
async function earnedNodeIds(userId: string): Promise<Map<string, number>> {
  const ticks = await prisma.progress.findMany({
    where: { userId, completed: true },
    select: { resourceId: true, moduleId: true },
  });
  const resourceIds = new Set<string>();
  for (const t of ticks) if (t.resourceId) resourceIds.add(t.resourceId);

  // A module tick stands in for its resources.
  const moduleIds = ticks.map((t) => t.moduleId).filter(Boolean) as string[];
  if (moduleIds.length) {
    const fromModules = await prisma.resource.findMany({
      where: { moduleId: { in: moduleIds } },
      select: { id: true },
    });
    for (const r of fromModules) resourceIds.add(r.id);
  }
  if (resourceIds.size === 0) return new Map();

  const rows = await prisma.coverage.findMany({
    where: {
      resourceId: { in: [...resourceIds] },
      depth: { in: [...HOLDING_DEPTHS] },
      node: { retiredAt: null },
    },
    select: { node: { select: { id: true, contentVersion: true } } },
  });
  return new Map(rows.map((r) => [r.node.id, r.node.contentVersion]));
}

/**
 * Recompute a user's provisional holdings from scratch against their current
 * ticks. Idempotent, and the only writer of provisional holdings — which means
 * unticking one resource cannot strip ground another tick still supports.
 *
 * Holdings earned non-provisionally (a defended session) are never touched.
 */
export async function recomputeProvisionalHoldings(userId: string): Promise<void> {
  const earned = await earnedNodeIds(userId);
  const existing = await prisma.holding.findMany({
    where: { userId },
    select: { nodeId: true, provisional: true },
  });
  const have = new Set(existing.map((h) => h.nodeId));
  const now = new Date();

  for (const [nodeId, contentVersion] of earned) {
    if (have.has(nodeId)) continue;
    await prisma.holding.create({
      data: { userId, nodeId, state: "HELD", provisional: true, contentVersion },
    });
  }

  const stale = existing
    .filter((h) => h.provisional && !earned.has(h.nodeId))
    .map((h) => h.nodeId);
  if (stale.length)
    await prisma.holding.deleteMany({ where: { userId, nodeId: { in: stale }, provisional: true } });

  // Re-touch what is still earned, so an active learner's holdings do not decay.
  if (earned.size)
    await prisma.holding.updateMany({
      where: { userId, nodeId: { in: [...earned.keys()] }, state: "HELD" },
      data: { lastTouchedAt: now, thinCause: "" },
    });
}

/** Backfill provisional holdings for one user from their existing ticks. */
export async function backfillHoldingsForUser(userId: string): Promise<void> {
  await recomputeProvisionalHoldings(userId);
}

type Adjacency = Map<string, Set<string>>;

/** Undirected adjacency over all edges (edge direction is advisory only). */
async function loadAdjacency(): Promise<Adjacency> {
  const edges = await prisma.edge.findMany({ select: { fromId: true, toId: true } });
  const adj: Adjacency = new Map();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const e of edges) {
    link(e.fromId, e.toId);
    link(e.toId, e.fromId);
  }
  return adj;
}

/**
 * Compute the frontier for a user: neighbours of held nodes that the user does
 * not already hold (held or thin). Returned as node ids.
 */
export async function getFrontierNodeIds(userId: string): Promise<Set<string>> {
  const holdings = await prisma.holding.findMany({
    where: { userId },
    select: { nodeId: true, state: true },
  });
  const heldIds = new Set(holdings.filter((h) => h.state === "HELD").map((h) => h.nodeId));
  const ownedIds = new Set(holdings.map((h) => h.nodeId)); // held ∪ thin
  const adj = await loadAdjacency();

  const frontier = new Set<string>();
  for (const id of heldIds) {
    const nbrs = adj.get(id);
    if (!nbrs) continue;
    for (const nb of nbrs) if (!ownedIds.has(nb)) frontier.add(nb);
  }
  return frontier;
}

/** The user's position (Lattice M6): held / frontier / thin + counters. */
export async function getPosition(userId: string): Promise<Position> {
  const holdings = await prisma.holding.findMany({
    where: { userId },
    include: { node: { select: { id: true, slug: true, title: true, regionId: true, retiredAt: true } } },
  });
  const live = holdings.filter((h) => h.node && !h.node.retiredAt);

  const held: PositionNode[] = [];
  const thin: PositionNode[] = [];
  for (const h of live) {
    const n = h.node!;
    const row: PositionNode = { id: n.id, slug: n.slug, title: n.title, regionId: n.regionId };
    if (h.state === "HELD") held.push(row);
    else thin.push({ ...row, thinCause: h.thinCause });
  }

  const frontierIds = await getFrontierNodeIds(userId);
  const frontierNodes = frontierIds.size
    ? await prisma.node.findMany({
        where: { id: { in: [...frontierIds] }, retiredAt: null },
        select: { id: true, slug: true, title: true, regionId: true },
      })
    : [];
  const frontier: PositionNode[] = frontierNodes.map((n) => ({
    id: n.id,
    slug: n.slug,
    title: n.title,
    regionId: n.regionId,
  }));

  return {
    held,
    frontier,
    thin,
    counters: { held: held.length, frontier: frontier.length, thin: thin.length },
  };
}

export type DecayResult = { elapsed: number; material: number };

/**
 * Decay job (Lattice M3): runs the held→thin transitions. Written by a nightly
 * job, never lazily at read time, so a user's map does not change while they
 * look at it. Two triggers: elapsed time without a touch, and a content-version
 * change on the node marked `material` by an author (the world moved).
 */
export async function runDecay(now: Date = new Date()): Promise<DecayResult> {
  const cutoff = new Date(now.getTime() - DECAY_MS);

  const elapsed = await prisma.holding.updateMany({
    where: { state: "HELD", lastTouchedAt: { lt: cutoff } },
    data: { state: "THIN" as HoldingState, thinCause: "elapsed" },
  });

  // Material: node advanced its contentVersion (and is flagged material) beyond
  // what the holding was established at.
  const materialNodes = await prisma.node.findMany({
    where: { material: true, retiredAt: null },
    select: { id: true, contentVersion: true },
  });
  let material = 0;
  for (const n of materialNodes) {
    const res = await prisma.holding.updateMany({
      where: { nodeId: n.id, state: "HELD", contentVersion: { lt: n.contentVersion } },
      data: { state: "THIN" as HoldingState, thinCause: "material" },
    });
    material += res.count;
  }

  return { elapsed: elapsed.count, material };
}
