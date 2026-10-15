import { prisma } from "./db";
import { STAKE_THRESHOLD, successTotal, successes, tickedCoverage } from "./points";

/**
 * Corrections. When an AI judgement is overturned, an answer key is fixed, or a
 * post is hidden, what it had granted must be taken back if nothing else still
 * supports it. Two things can have been granted: a firm hold on a node, and a
 * stake (expert standing) on it.
 *
 *  - A stake whose successes have fallen below the threshold is removed.
 *  - A firm (non-provisional) hold with no remaining evidence is removed, unless
 *    the user's ticks still earn it, in which case it goes back to the tick engine
 *    (provisional) and nothing else changes.
 *
 * "Evidence" for a hold is: a correct answer that is still visible, a quiz passed
 * with no mistakes, or a stake.
 */
export async function reconcile(userId: string, nodeId: string): Promise<{ stakeRemoved: boolean; holdRemoved: boolean }> {
  let stakeRemoved = false;
  let holdRemoved = false;

  const stake = await prisma.stake.findUnique({ where: { userId_nodeId: { userId, nodeId } }, select: { id: true } });
  if (stake && successTotal(await successes(userId, nodeId)) < STAKE_THRESHOLD) {
    await prisma.stake.delete({ where: { id: stake.id } });
    stakeRemoved = true;
  }

  const holding = await prisma.holding.findUnique({
    where: { userId_nodeId: { userId, nodeId } },
    select: { id: true, provisional: true, stake: { select: { id: true } } },
  });
  if (!holding || holding.provisional || holding.stake) return { stakeRemoved, holdRemoved };

  const [correct, passed] = await Promise.all([
    prisma.answer.count({ where: { authorId: userId, verdict: "CORRECT", hiddenAt: null, question: { nodeId, hiddenAt: null } } }),
    prisma.quizAttempt.count({ where: { userId, passed: true, quiz: { nodeId } } }),
  ]);
  if (correct + passed > 0) return { stakeRemoved, holdRemoved };

  if ((await tickedCoverage(userId, nodeId)) > 0) {
    await prisma.holding.update({ where: { id: holding.id }, data: { provisional: true } });
  } else {
    await prisma.holding.delete({ where: { id: holding.id } });
    holdRemoved = true;
  }
  return { stakeRemoved, holdRemoved };
}
