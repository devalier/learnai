import { prisma } from "./db";
import { getFrontierNodeIds } from "./holdings";

/**
 * Graph service (Lattice M2/graph-service).
 *
 * Reads the shared, multi-user graph. At the expected scale (low thousands of
 * nodes) we return the whole graph in one slice; `center`/`radius` are accepted
 * for forward-compatibility but not yet used to scope the payload.
 */

export type SliceNode = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  kind: string;
  regionId: string | null;
  x: number;
  y: number;
  /** viewer's relation: held | frontier | thin | mapped (held by others) | unmapped */
  state: "held" | "frontier" | "thin" | "mapped" | "unmapped";
  /** how many users currently hold this node (held or thin) */
  presence: number;
};

export type SliceEdge = { fromId: string; toId: string; kind: string };
export type SliceRegion = { id: string; slug: string; name: string; blurb: string; labelX: number; labelY: number };

export type GraphSlice = {
  nodes: SliceNode[];
  edges: SliceEdge[];
  regions: SliceRegion[];
};

/** Count of distinct users holding each node (any holding state). */
async function presenceByNode(): Promise<Map<string, number>> {
  const rows = await prisma.holding.groupBy({ by: ["nodeId"], _count: { userId: true } });
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.nodeId, r._count.userId);
  return map;
}

export async function getGraphSlice(userId?: string): Promise<GraphSlice> {
  const [nodes, edges, regions, presence] = await Promise.all([
    prisma.node.findMany({
      where: { retiredAt: null },
      orderBy: { order: "asc" },
      select: { id: true, slug: true, title: true, summary: true, kind: true, regionId: true, x: true, y: true },
    }),
    prisma.edge.findMany({ select: { fromId: true, toId: true, kind: true } }),
    prisma.region.findMany({
      orderBy: { order: "asc" },
      select: { id: true, slug: true, name: true, blurb: true, labelX: true, labelY: true },
    }),
    presenceByNode(),
  ]);

  let heldIds = new Set<string>();
  let thinIds = new Set<string>();
  let frontierIds = new Set<string>();
  if (userId) {
    const holdings = await prisma.holding.findMany({
      where: { userId },
      select: { nodeId: true, state: true },
    });
    heldIds = new Set(holdings.filter((h) => h.state === "HELD").map((h) => h.nodeId));
    thinIds = new Set(holdings.filter((h) => h.state === "THIN").map((h) => h.nodeId));
    frontierIds = await getFrontierNodeIds(userId);
  }

  const sliceNodes: SliceNode[] = nodes.map((n) => {
    let state: SliceNode["state"] = "unmapped";
    if (heldIds.has(n.id)) state = "held";
    else if (thinIds.has(n.id)) state = "thin";
    else if (frontierIds.has(n.id)) state = "frontier";
    else if ((presence.get(n.id) ?? 0) > 0) state = "mapped";
    return { ...n, state, presence: presence.get(n.id) ?? 0 };
  });

  return { nodes: sliceNodes, edges, regions };
}

export type NodeClaim = {
  id: string;
  text: string;
  for: number;
  against: number;
  myStance: "FOR" | "AGAINST" | null;
};

export type NodeDetail = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  kind: string;
  region: { id: string; name: string } | null;
  references: { id: string; url: string; title: string; kind: string; author: string }[];
  claims: NodeClaim[];
  presence: { count: number; names: string[] };
  holdingState: "held" | "thin" | null;
} | null;

/** Full node panel (Lattice M2 node panel). */
export async function getNodeDetail(slug: string, userId?: string): Promise<NodeDetail> {
  const node = await prisma.node.findUnique({
    where: { slug },
    include: {
      region: { select: { id: true, name: true } },
      references: { orderBy: { order: "asc" }, select: { id: true, url: true, title: true, kind: true, author: true } },
      claims: {
        orderBy: { createdAt: "asc" },
        include: { positions: { select: { stance: true, userId: true } } },
      },
    },
  });
  if (!node || node.retiredAt) return null;

  // Presence: total holders, plus up to three who opted into presence.
  const holders = await prisma.holding.findMany({
    where: { nodeId: node.id },
    select: { user: { select: { name: true, presenceOptIn: true } } },
  });
  const names = holders
    .filter((h) => h.user?.presenceOptIn)
    .map((h) => h.user!.name)
    .slice(0, 3);

  let holdingState: "held" | "thin" | null = null;
  if (userId) {
    const h = await prisma.holding.findUnique({
      where: { userId_nodeId: { userId, nodeId: node.id } },
      select: { state: true },
    });
    holdingState = h ? (h.state === "HELD" ? "held" : "thin") : null;
  }

  const claims: NodeClaim[] = node.claims.map((c) => ({
    id: c.id,
    text: c.text,
    for: c.positions.filter((p) => p.stance === "FOR").length,
    against: c.positions.filter((p) => p.stance === "AGAINST").length,
    myStance: userId ? (c.positions.find((p) => p.userId === userId)?.stance ?? null) : null,
  }));

  return {
    id: node.id,
    slug: node.slug,
    title: node.title,
    summary: node.summary,
    kind: node.kind,
    region: node.region,
    references: node.references,
    claims,
    presence: { count: holders.length, names },
    holdingState,
  };
}
