import { NextResponse } from "next/server";
import { prisma } from "./db";
import { getSession } from "./auth";
import {
  AiUnavailableError, aiAnswerQuestion, aiJudgeAnswer, aiReviewJudgement,
  type Judgement, type NodeContext,
} from "./ai";

/**
 * Social Q&A: questions, answers, votes, AI judgement and challenges.
 * Everything here requires the user to have opted in to social features.
 */

export class QaError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function qaErrorResponse(e: unknown) {
  if (e instanceof QaError) return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
  throw e;
}

/** Resolve the signed-in, opted-in user, or a ready-made error response. */
export async function socialGuard(): Promise<{ userId: string } | { res: NextResponse }> {
  const session = await getSession();
  if (!session) return { res: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
  const u = await prisma.user.findUnique({ where: { id: session.sub }, select: { presenceOptIn: true } });
  if (!u?.presenceOptIn)
    return { res: NextResponse.json({ error: "SOCIAL_OPT_IN_REQUIRED" }, { status: 403 }) };
  return { userId: session.sub };
}

const HOUR = 60 * 60 * 1000;
const LIMITS = { question: 10, answer: 20, review: 5 }; // per hour, per hour, per day

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "Someone";

export type Tx = Pick<typeof prisma, "holding">;

/** Passing a question holds the node, firmly (not provisional) and fresh. */
export async function grantHold(tx: Tx, userId: string, nodeId: string) {
  const node = await prisma.node.findUnique({ where: { id: nodeId }, select: { contentVersion: true } });
  await tx.holding.upsert({
    where: { userId_nodeId: { userId, nodeId } },
    update: { state: "HELD", provisional: false, lastTouchedAt: new Date(), thinCause: "" },
    create: { userId, nodeId, state: "HELD", provisional: false, contentVersion: node?.contentVersion ?? 1 },
  });
}

export async function nodeContext(nodeId: string): Promise<NodeContext> {
  const n = await prisma.node.findUniqueOrThrow({
    where: { id: nodeId },
    select: { title: true, summary: true, whatItMeans: true, commonlyWrong: true },
  });
  return n;
}

// ─── Reading ────────────────────────────────────────────────────────────────

export type QaAnswer = {
  id: string;
  text: string;
  author: string;
  mine: boolean;
  score: number;
  myVote: number;
  verdict: "CORRECT" | "INCORRECT" | "UNSURE" | null;
  aiReason: string;
  challenged: boolean;
  createdAt: string;
};
export type QaQuestion = {
  id: string;
  text: string;
  author: string;
  mine: boolean;
  aiAnswer: string;
  score: number;
  myVote: number;
  answers: QaAnswer[];
  createdAt: string;
};
export type QaList = { questions: QaQuestion[]; canVote: boolean };

type VoteRow = { userId: string; value: number };
const tally = (votes: VoteRow[], me: string) => ({
  score: votes.reduce((s, v) => s + v.value, 0),
  myVote: votes.find((v) => v.userId === me)?.value ?? 0,
});
const VERDICT_RANK = { CORRECT: 0, UNSURE: 1, INCORRECT: 2 } as const;

export async function listQa(slug: string, userId: string): Promise<QaList | null> {
  const node = await prisma.node.findUnique({ where: { slug }, select: { id: true, retiredAt: true } });
  if (!node || node.retiredAt) return null;
  const [rows, holding] = await Promise.all([
    prisma.question.findMany({
      where: { nodeId: node.id, author: { presenceOptIn: true } },
      include: {
        author: { select: { name: true } },
        votes: { select: { userId: true, value: true } },
        answers: {
          where: { author: { presenceOptIn: true } },
          include: {
            author: { select: { name: true } },
            votes: { select: { userId: true, value: true } },
            reviews: { select: { id: true } },
          },
        },
      },
    }),
    prisma.holding.findUnique({ where: { userId_nodeId: { userId, nodeId: node.id } }, select: { id: true } }),
  ]);

  const questions: QaQuestion[] = rows.map((q) => {
    const answers: QaAnswer[] = q.answers.map((a) => ({
      id: a.id,
      text: a.text,
      author: firstName(a.author.name),
      mine: a.authorId === userId,
      ...tally(a.votes, userId),
      verdict: a.verdict,
      aiReason: a.aiReason,
      challenged: a.reviews.length > 0,
      createdAt: a.createdAt.toISOString(),
    }));
    // Best answers float to the top: votes first, then AI-correct, then newest.
    answers.sort(
      (x, y) =>
        y.score - x.score ||
        (x.verdict ? VERDICT_RANK[x.verdict] : 1) - (y.verdict ? VERDICT_RANK[y.verdict] : 1) ||
        y.createdAt.localeCompare(x.createdAt)
    );
    return {
      id: q.id,
      text: q.text,
      author: firstName(q.author.name),
      mine: q.authorId === userId,
      aiAnswer: q.aiAnswer,
      ...tally(q.votes, userId),
      answers,
      createdAt: q.createdAt.toISOString(),
    };
  });
  questions.sort((x, y) => y.score - x.score || y.createdAt.localeCompare(x.createdAt));
  return { questions, canVote: !!holding };
}

// ─── Writing ────────────────────────────────────────────────────────────────

function checkLen(text: unknown, min: number, max: number, what: string): string {
  const t = typeof text === "string" ? text.trim() : "";
  if (t.length < min) throw new QaError(400, "TOO_SHORT", `${what} must be at least ${min} characters.`);
  if (t.length > max) throw new QaError(400, "TOO_LONG", `${what} must be at most ${max} characters.`);
  return t;
}

async function rateLimit(kind: "question" | "answer" | "review", userId: string) {
  const since = new Date(Date.now() - (kind === "review" ? 24 * HOUR : HOUR));
  const n =
    kind === "question"
      ? await prisma.question.count({ where: { authorId: userId, createdAt: { gte: since } } })
      : kind === "answer"
        ? await prisma.answer.count({ where: { authorId: userId, createdAt: { gte: since } } })
        : await prisma.answerReview.count({ where: { userId, createdAt: { gte: since } } });
  if (n >= LIMITS[kind])
    throw new QaError(429, "RATE_LIMITED", "You are doing that too fast. Please try again later.");
}

export async function createQuestion(userId: string, slug: string, rawText: unknown) {
  const text = checkLen(rawText, 10, 500, "A question");
  const node = await prisma.node.findUnique({ where: { slug }, select: { id: true, retiredAt: true } });
  if (!node || node.retiredAt) throw new QaError(404, "NOT_FOUND", "Node not found.");
  await rateLimit("question", userId);

  // The AI screens the question and writes a labelled reference answer. If the
  // AI is down the question is still accepted, without a reference answer.
  let aiAnswer = "";
  try {
    const check = await aiAnswerQuestion(await nodeContext(node.id), text);
    if (!check.onTopic)
      throw new QaError(422, "OFF_TOPIC", "That does not look like a question about this topic. Please rephrase it.");
    aiAnswer = check.answer;
  } catch (e) {
    if (!(e instanceof AiUnavailableError)) throw e;
  }
  const q = await prisma.question.create({ data: { nodeId: node.id, authorId: userId, text, aiAnswer } });
  return { id: q.id };
}

export async function createAnswer(userId: string, questionId: string, rawText: unknown) {
  const text = checkLen(rawText, 10, 2000, "An answer");
  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) throw new QaError(404, "NOT_FOUND", "Question not found.");
  const dup = await prisma.answer.findFirst({ where: { questionId, authorId: userId }, select: { id: true } });
  if (dup) throw new QaError(409, "ALREADY_ANSWERED", "You have already answered this question.");
  await rateLimit("answer", userId);

  let j: Judgement | null = null;
  try {
    j = await aiJudgeAnswer(await nodeContext(q.nodeId), q.text, q.aiAnswer, text);
  } catch (e) {
    if (!(e instanceof AiUnavailableError)) throw e;
  }
  const a = await prisma.$transaction(async (tx) => {
    const created = await tx.answer.create({
      data: {
        questionId, authorId: userId, text,
        verdict: j?.verdict ?? null, aiReason: j?.reason ?? "", judgedAt: j ? new Date() : null,
      },
    });
    if (j?.verdict === "CORRECT") await grantHold(tx, userId, q.nodeId);
    return created;
  });
  return { id: a.id, verdict: a.verdict, judged: !!j };
}

/** value: 1, -1, or 0 to withdraw. Voters must be opted in and hold the node. */
export async function castVote(userId: string, target: { questionId?: string; answerId?: string }, value: unknown) {
  if (value !== 1 && value !== -1 && value !== 0) throw new QaError(400, "BAD_VALUE", "value must be 1, -1 or 0.");
  if (!!target.questionId === !!target.answerId) throw new QaError(400, "BAD_TARGET", "Vote on a question or an answer.");

  let nodeId: string, authorId: string;
  if (target.questionId) {
    const q = await prisma.question.findUnique({ where: { id: target.questionId }, select: { nodeId: true, authorId: true } });
    if (!q) throw new QaError(404, "NOT_FOUND", "Question not found.");
    ({ nodeId, authorId } = q);
  } else {
    const a = await prisma.answer.findUnique({
      where: { id: target.answerId! },
      select: { authorId: true, question: { select: { nodeId: true } } },
    });
    if (!a) throw new QaError(404, "NOT_FOUND", "Answer not found.");
    nodeId = a.question.nodeId;
    authorId = a.authorId;
  }
  if (authorId === userId) throw new QaError(403, "OWN_CONTENT", "You cannot vote on your own post.");
  const holds = await prisma.holding.findUnique({ where: { userId_nodeId: { userId, nodeId } }, select: { id: true } });
  if (!holds) throw new QaError(403, "MUST_HOLD_NODE", "You can vote once you hold this node.");

  const where = target.questionId
    ? { userId_questionId: { userId, questionId: target.questionId } }
    : { userId_answerId: { userId, answerId: target.answerId! } };
  if (value === 0) {
    await prisma.vote.deleteMany({ where: { userId, ...(target.questionId ? { questionId: target.questionId } : { answerId: target.answerId }) } });
  } else {
    await prisma.vote.upsert({
      where,
      update: { value },
      create: { userId, value, questionId: target.questionId ?? null, answerId: target.answerId ?? null },
    });
  }
}

/**
 * Challenge an AI judgement. The AI re-assesses it once; that outcome is final.
 * An answer the AI never judged is simply judged now (no explanation needed).
 */
export async function reviewAnswer(userId: string, answerId: string, rawExplanation: unknown) {
  const a = await prisma.answer.findUnique({
    where: { id: answerId },
    include: { question: true, reviews: { select: { id: true } } },
  });
  if (!a) throw new QaError(404, "NOT_FOUND", "Answer not found.");
  const ctx = await nodeContext(a.question.nodeId);

  if (a.verdict === null) {
    await rateLimit("review", userId);
    let j: Judgement;
    try {
      j = await aiJudgeAnswer(ctx, a.question.text, a.question.aiAnswer, a.text);
    } catch (e) {
      if (e instanceof AiUnavailableError) throw new QaError(503, "AI_UNAVAILABLE", "The AI is unavailable. Try again later.");
      throw e;
    }
    await prisma.$transaction(async (tx) => {
      await tx.answer.update({ where: { id: a.id }, data: { verdict: j.verdict, aiReason: j.reason, judgedAt: new Date() } });
      if (j.verdict === "CORRECT") await grantHold(tx, a.authorId, a.question.nodeId);
    });
    return { verdict: j.verdict, overturned: false };
  }

  const explanation = checkLen(rawExplanation, 10, 1000, "Your explanation");
  if (a.reviews.length > 0) throw new QaError(409, "ALREADY_REVIEWED", "This judgement has already been re-assessed.");
  await rateLimit("review", userId);

  const previous: Judgement = { verdict: a.verdict, reason: a.aiReason };
  let j: Judgement;
  try {
    j = await aiReviewJudgement(ctx, a.question.text, a.question.aiAnswer, a.text, previous, explanation);
  } catch (e) {
    if (e instanceof AiUnavailableError) throw new QaError(503, "AI_UNAVAILABLE", "The AI is unavailable. Try again later.");
    throw e;
  }
  const overturned = j.verdict !== previous.verdict;
  await prisma.$transaction(async (tx) => {
    await tx.answerReview.create({
      data: { answerId: a.id, userId, explanation, outcome: overturned ? "OVERTURNED" : "UPHELD", aiReason: j.reason },
    });
    if (overturned) {
      await tx.answer.update({ where: { id: a.id }, data: { verdict: j.verdict, aiReason: j.reason, judgedAt: new Date() } });
      if (j.verdict === "CORRECT") await grantHold(tx, a.authorId, a.question.nodeId);
    }
  });
  return { verdict: j.verdict, overturned };
}
