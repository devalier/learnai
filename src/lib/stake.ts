import { prisma } from "./db";
import { QaError } from "./qa";
import { STAKE_THRESHOLD, nodePoints, successTotal, successes } from "./points";

/**
 * Staking: an explicit claim of expertise on one node. You may stake a node you
 * currently hold once you have enough successes on it. A staked node never thins.
 * The experts list shows the top 10 staked people by points, by first name, and
 * never shows the points themselves.
 */

export const EXPERT_LIMIT = 10;

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "Someone";

export type Experts = {
  experts: { rank: number; name: string; mine: boolean }[];
  me: { holds: boolean; staked: boolean; successes: number; needed: number; eligible: boolean };
};

export async function getExperts(slug: string, userId: string): Promise<Experts | null> {
  const node = await prisma.node.findUnique({ where: { slug }, select: { id: true, retiredAt: true } });
  if (!node || node.retiredAt) return null;

  const [stakes, mine, holding, c] = await Promise.all([
    prisma.stake.findMany({
      where: { nodeId: node.id, user: { presenceOptIn: true } },
      select: { userId: true, createdAt: true, user: { select: { name: true } } },
    }),
    prisma.stake.findUnique({ where: { userId_nodeId: { userId, nodeId: node.id } }, select: { id: true } }),
    prisma.holding.findUnique({ where: { userId_nodeId: { userId, nodeId: node.id } }, select: { state: true } }),
    successes(userId, node.id),
  ]);

  const scored = await Promise.all(stakes.map(async (s) => ({ ...s, pts: await nodePoints(s.userId, node.id) })));
  scored.sort((a, b) => b.pts - a.pts || a.createdAt.getTime() - b.createdAt.getTime());
  const top = scored.slice(0, EXPERT_LIMIT);

  const total = successTotal(c);
  return {
    experts: top.map((s, i) => ({ rank: i + 1, name: firstName(s.user.name), mine: s.userId === userId })),
    me: {
      holds: holding?.state === "HELD",
      staked: !!mine,
      successes: total,
      needed: STAKE_THRESHOLD,
      eligible: holding?.state === "HELD" && total >= STAKE_THRESHOLD && !mine,
    },
  };
}

export async function stakeNode(userId: string, slug: string) {
  const node = await prisma.node.findUnique({ where: { slug }, select: { id: true, retiredAt: true } });
  if (!node || node.retiredAt) throw new QaError(404, "NOT_FOUND", "Node not found.");
  const holding = await prisma.holding.findUnique({
    where: { userId_nodeId: { userId, nodeId: node.id } },
    select: { id: true, state: true, stake: { select: { id: true } } },
  });
  if (holding?.stake) throw new QaError(409, "ALREADY_STAKED", "You have already staked this node.");
  if (!holding || holding.state !== "HELD")
    throw new QaError(403, "MUST_HOLD", "You can stake a node you currently hold. Pass a quiz or answer a question correctly first.");
  const total = successTotal(await successes(userId, node.id));
  if (total < STAKE_THRESHOLD)
    throw new QaError(403, "NOT_ELIGIBLE", `You need ${STAKE_THRESHOLD} successes on this node to stake it. You have ${total}.`);

  await prisma.$transaction([
    // A stake makes the hold firm: it can no longer be undone by unticking.
    prisma.holding.update({ where: { id: holding.id }, data: { provisional: false, lastTouchedAt: new Date(), thinCause: "" } }),
    prisma.stake.create({ data: { holdingId: holding.id, userId, nodeId: node.id } }),
  ]);
}

export async function unstakeNode(userId: string, slug: string) {
  const node = await prisma.node.findUnique({ where: { slug }, select: { id: true } });
  if (!node) throw new QaError(404, "NOT_FOUND", "Node not found.");
  const r = await prisma.stake.deleteMany({ where: { userId, nodeId: node.id } });
  if (r.count === 0) throw new QaError(404, "NOT_STAKED", "You have not staked this node.");
}
