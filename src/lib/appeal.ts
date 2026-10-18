import { prisma } from "./db";
import { QaError, grantHold } from "./qa";
import { regradeQuiz, requireWrongAnswer } from "./quiz";
import { hit } from "./ratelimit";

/**
 * Appeals to an admin. The AI re-checks a challenge once; if the person still
 * thinks it is wrong they can ask an admin. Two rules keep this private and bounded:
 *  - only the person whose answer was marked wrong can appeal it (the answer's author;
 *    for a quiz, someone who took it and got that question wrong), and
 *  - only an admin reads the appeal. Nobody else sees that one exists.
 */

const DAY = 24 * 60 * 60 * 1000;
const DAILY_LIMIT = 5;

function explanationOf(raw: unknown): string {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (t.length < 10) throw new QaError(400, "TOO_SHORT", "Your explanation must be at least 10 characters.");
  if (t.length > 1000) throw new QaError(400, "TOO_LONG", "Your explanation must be at most 1000 characters.");
  return t;
}

const limited = async (userId: string) => {
  if (await hit(`appeal:${userId}`, { max: DAILY_LIMIT, windowMs: DAY }))
    throw new QaError(429, "RATE_LIMITED", "You are doing that too fast. Please try again later.");
};

// ─── The person appealing ───────────────────────────────────────────────────

export async function appealAnswer(userId: string, answerId: string, rawExplanation: unknown) {
  const a = await prisma.answer.findUnique({
    where: { id: answerId },
    include: { question: { select: { hiddenAt: true } }, reviews: { select: { id: true } }, appeal: { select: { id: true } } },
  });
  if (!a || a.hiddenAt || a.question.hiddenAt) throw new QaError(404, "NOT_FOUND", "Answer not found.");
  if (a.authorId !== userId) throw new QaError(403, "NOT_YOURS", "You can only appeal your own answer.");
  if (a.verdict === "CORRECT" || a.verdict === null) throw new QaError(409, "NOT_WRONG", "Only an answer marked wrong can be appealed.");
  if (a.reviews.length === 0) throw new QaError(409, "AI_FIRST", "Ask the AI to re-assess it first. You can appeal if you still disagree.");
  if (a.appeal) throw new QaError(409, "ALREADY_APPEALED", "You have already appealed this.");
  const explanation = explanationOf(rawExplanation);
  await limited(userId);
  await prisma.answerAppeal.create({ data: { answerId, userId, explanation } });
}

export async function appealQuizQuestion(userId: string, questionId: string, rawExplanation: unknown) {
  const q = await prisma.quizQuestion.findUnique({
    where: { id: questionId },
    include: { quiz: { select: { hiddenAt: true } }, review: { select: { id: true } }, appeals: { where: { userId }, select: { id: true } } },
  });
  if (!q || q.quiz.hiddenAt) throw new QaError(404, "NOT_FOUND", "Question not found.");
  await requireWrongAnswer(userId, q);
  // The AI has re-checked this key (for you or for another taker) and you still disagree.
  if (!q.review) throw new QaError(409, "AI_FIRST", "Ask the AI to re-check the key first. You can appeal if you still disagree.");
  if (q.appeals.length > 0) throw new QaError(409, "ALREADY_APPEALED", "You have already appealed this.");
  const explanation = explanationOf(rawExplanation);
  await limited(userId);
  await prisma.quizQuestionAppeal.create({ data: { questionId, userId, explanation } });
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export type AppealItem =
  | {
      kind: "answer";
      id: string;
      who: string;
      node: string;
      explanation: string;
      createdAt: string;
      question: string;
      answer: string;
      aiReason: string;
      aiRecheck: { outcome: string; reason: string } | null;
    }
  | {
      kind: "quiz";
      id: string;
      who: string;
      node: string;
      explanation: string;
      createdAt: string;
      question: string;
      options: string[];
      key: number;
      theirAnswer: number | null;
      keyExplanation: string;
      aiRecheck: { outcome: string; reason: string } | null;
    };

/** Open appeals, oldest first. */
export async function listOpenAppeals(): Promise<AppealItem[]> {
  const [answers, quizzes] = await Promise.all([
    prisma.answerAppeal.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { name: true } },
        answer: { include: { question: { select: { text: true, node: { select: { title: true } } } }, reviews: { select: { outcome: true, aiReason: true } } } },
      },
    }),
    prisma.quizQuestionAppeal.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { name: true } },
        question: { include: { quiz: { select: { id: true, node: { select: { title: true } } } }, review: { select: { outcome: true, aiReason: true } } } },
      },
    }),
  ]);
  const attempts = await prisma.quizAttempt.findMany({
    where: { OR: quizzes.map((x) => ({ quizId: x.question.quizId, userId: x.userId })) },
    select: { quizId: true, userId: true, answers: true },
  });
  const items: AppealItem[] = [
    ...answers.map((x): AppealItem => ({
      kind: "answer", id: x.id, who: x.user.name, node: x.answer.question.node.title, explanation: x.explanation,
      createdAt: x.createdAt.toISOString(), question: x.answer.question.text, answer: x.answer.text, aiReason: x.answer.aiReason,
      aiRecheck: x.answer.reviews[0] ? { outcome: x.answer.reviews[0].outcome, reason: x.answer.reviews[0].aiReason } : null,
    })),
    ...quizzes.map((x): AppealItem => ({
      kind: "quiz", id: x.id, who: x.user.name, node: x.question.quiz.node.title, explanation: x.explanation,
      createdAt: x.createdAt.toISOString(), question: x.question.text, options: x.question.options, key: x.question.correctIndex,
      theirAnswer: attempts.find((a) => a.quizId === x.question.quizId && a.userId === x.userId)?.answers[x.question.position] ?? null,
      keyExplanation: x.question.explanation,
      aiRecheck: x.question.review ? { outcome: x.question.review.outcome, reason: x.question.review.aiReason } : null,
    })),
  ];
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const noteOf = (n: unknown) => (typeof n === "string" ? n.trim().slice(0, 500) : "");

/**
 * answer: "uphold" keeps the judgement; "overturn" marks the answer correct and grants the hold.
 * quiz:   "uphold" keeps the key; "fix" (with correctIndex) changes it; "void" removes the
 *         question from scoring. Fixing or voiding grades every attempt on the quiz again.
 */
export async function decideAppeal(kind: unknown, id: unknown, action: unknown, extra: { correctIndex?: unknown; note?: unknown }) {
  if ((kind !== "answer" && kind !== "quiz") || typeof id !== "string") throw new QaError(400, "BAD_TARGET", "Bad target.");
  const adminNote = noteOf(extra.note);
  const decidedAt = new Date();

  if (kind === "answer") {
    if (action !== "uphold" && action !== "overturn") throw new QaError(400, "BAD_ACTION", "Bad action.");
    const ap = await prisma.answerAppeal.findUnique({ where: { id }, include: { answer: { include: { question: { select: { nodeId: true, hiddenAt: true } } } } } });
    if (!ap) throw new QaError(404, "NOT_FOUND", "Appeal not found.");
    if (ap.status !== "OPEN") throw new QaError(409, "NOT_OPEN", "That appeal has already been decided.");
    if (action === "uphold") {
      await prisma.answerAppeal.update({ where: { id }, data: { status: "UPHELD", adminNote, decidedAt } });
      return { status: "UPHELD" as const };
    }
    if (ap.answer.hiddenAt || ap.answer.question.hiddenAt)
      throw new QaError(409, "HIDDEN", "That answer is hidden by moderation. Restore it before overturning.");
    await prisma.$transaction(async (tx) => {
      await tx.answer.update({ where: { id: ap.answerId }, data: { verdict: "CORRECT", aiReason: "Overturned by an admin on appeal.", judgedAt: decidedAt } });
      await grantHold(tx, ap.answer.authorId, ap.answer.question.nodeId);
      await tx.answerAppeal.update({ where: { id }, data: { status: "OVERTURNED", adminNote, decidedAt } });
    });
    return { status: "OVERTURNED" as const };
  }

  if (action !== "uphold" && action !== "fix" && action !== "void") throw new QaError(400, "BAD_ACTION", "Bad action.");
  const ap = await prisma.quizQuestionAppeal.findUnique({ where: { id }, include: { question: true } });
  if (!ap) throw new QaError(404, "NOT_FOUND", "Appeal not found.");
  if (ap.status !== "OPEN") throw new QaError(409, "NOT_OPEN", "That appeal has already been decided.");
  if (action === "uphold") {
    await prisma.quizQuestionAppeal.update({ where: { id }, data: { status: "UPHELD", adminNote, decidedAt } });
    return { status: "UPHELD" as const };
  }
  const q = ap.question;
  if (action === "fix") {
    const idx = extra.correctIndex;
    if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0 || idx >= q.options.length || idx === q.correctIndex)
      throw new QaError(400, "BAD_KEY", "Choose a different option as the correct answer.");
    await prisma.$transaction([
      prisma.quizQuestion.update({ where: { id: q.id }, data: { correctIndex: idx } }),
      prisma.quizQuestionAppeal.update({ where: { id }, data: { status: "OVERTURNED", resolution: "KEY_FIXED", adminNote, decidedAt } }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.quizQuestion.update({ where: { id: q.id }, data: { voided: true } }),
      prisma.quizQuestionAppeal.update({ where: { id }, data: { status: "OVERTURNED", resolution: "VOIDED", adminNote, decidedAt } }),
    ]);
  }
  const regraded = await regradeQuiz(q.quizId);
  return { status: "OVERTURNED" as const, ...regraded };
}
