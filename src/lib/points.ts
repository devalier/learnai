import { prisma } from "./db";

/**
 * Points. Internal only: they rank people on a node's experts list and are
 * never shown to users as numbers. They are computed on demand from the
 * underlying activity (nothing is stored, so nothing can drift), and are
 * included when a user asks for a copy of their data.
 *
 * All of it is per node. Tick points count only while the node is held: a thin
 * node earns nothing from ticks (a staked node never goes thin).
 */

export const POINTS = {
  correctAnswer: 3, // an answer the AI judged correct
  passedQuiz: 4, // a quiz taken with no mistakes
  quizWritten: 3, // a quiz someone else passed
  voteNet: 1, // per net vote on your questions and answers, and per net rating on your quizzes (never below 0)
  tick: 1, // per ticked resource that defines or demonstrates the node
  tickCap: 5,
} as const;

/** Successes needed before a user may stake a node. */
export const STAKE_THRESHOLD = 3;

const sum = (xs: { value: number }[]) => xs.reduce((s, x) => s + x.value, 0);

export type Contributions = { correctAnswers: number; passedQuizzes: number; goodQuizzes: number };

/**
 * "Successes" on a node: answers judged correct, quizzes passed with no mistakes,
 * and quizzes you wrote that someone else passed and that were not rated down.
 */
export async function successes(userId: string, nodeId: string): Promise<Contributions> {
  const [correctAnswers, passedQuizzes, written] = await Promise.all([
    prisma.answer.count({ where: { authorId: userId, verdict: "CORRECT", hiddenAt: null, question: { nodeId, hiddenAt: null } } }),
    prisma.quizAttempt.count({ where: { userId, passed: true, quiz: { nodeId } } }),
    prisma.quiz.findMany({
      where: { authorId: userId, nodeId, hiddenAt: null },
      select: { ratings: { select: { value: true } }, attempts: { where: { passed: true, userId: { not: userId } }, select: { id: true } } },
    }),
  ]);
  const goodQuizzes = written.filter((q) => q.attempts.length > 0 && sum(q.ratings) >= 0).length;
  return { correctAnswers, passedQuizzes, goodQuizzes };
}

export const successTotal = (c: Contributions) => c.correctAnswers + c.passedQuizzes + c.goodQuizzes;

/** A user's points on one node. */
export async function nodePoints(userId: string, nodeId: string): Promise<number> {
  const [c, answers, questions, quizzes, holding] = await Promise.all([
    successes(userId, nodeId),
    prisma.answer.findMany({ where: { authorId: userId, hiddenAt: null, question: { nodeId, hiddenAt: null } }, select: { votes: { select: { value: true } } } }),
    prisma.question.findMany({ where: { authorId: userId, nodeId, hiddenAt: null }, select: { votes: { select: { value: true } } } }),
    prisma.quiz.findMany({ where: { authorId: userId, nodeId, hiddenAt: null }, select: { ratings: { select: { value: true } } } }),
    prisma.holding.findUnique({ where: { userId_nodeId: { userId, nodeId } }, select: { state: true } }),
  ]);
  let pts = c.correctAnswers * POINTS.correctAnswer + c.passedQuizzes * POINTS.passedQuiz + c.goodQuizzes * POINTS.quizWritten;
  for (const group of [answers, questions, quizzes]) {
    for (const g of group) pts += Math.max(0, sum("votes" in g ? g.votes : g.ratings)) * POINTS.voteNet;
  }
  if (holding?.state === "HELD") pts += Math.min(await tickedCoverage(userId, nodeId), POINTS.tickCap) * POINTS.tick;
  return pts;
}

/** Resources the user has ticked that define or demonstrate the node (directly or via a ticked module). */
export function tickedCoverage(userId: string, nodeId: string): Promise<number> {
  return prisma.coverage.count({
    where: {
      nodeId,
      depth: { in: ["DEFINES", "DEMONSTRATES"] },
      resource: {
        OR: [
          { progress: { some: { userId, completed: true } } },
          { module: { progress: { some: { userId, completed: true } } } },
        ],
      },
    },
  });
}
