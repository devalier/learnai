import { randomInt } from "crypto";
import { prisma } from "./db";
import { AiUnavailableError, aiGenerateQuiz, aiReviewQuizKey } from "./ai";
import { QaError, grantHold, nodeContext } from "./qa";

/**
 * Social quizzes: three AI-written multiple-choice questions per quiz. Passing
 * holds the node, failing thins it. Grading is deterministic (an answer key);
 * the AI only writes questions and re-checks a key someone challenges.
 */

const DAY = 24 * 60 * 60 * 1000;
const LIMITS = { quiz: 3, review: 5 }; // per day, per user

/** Pass mark: every counted question. No mistakes (3 of 3, or 2 of 2 if one was voided). */
export const passMark = (total: number) => total;

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "Someone";

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// ─── Reading ────────────────────────────────────────────────────────────────

export type QuizSummary = {
  id: string;
  focus: string;
  author: string;
  mine: boolean;
  score: number;
  myRating: number;
  canRate: boolean;
  passers: number;
  myAttempt: { correct: number; total: number; passed: boolean } | null;
  createdAt: string;
};

export async function listQuizzes(slug: string, userId: string): Promise<QuizSummary[] | null> {
  const node = await prisma.node.findUnique({ where: { slug }, select: { id: true, retiredAt: true } });
  if (!node || node.retiredAt) return null;
  const rows = await prisma.quiz.findMany({
    where: { nodeId: node.id, author: { presenceOptIn: true } },
    include: {
      author: { select: { name: true } },
      ratings: { select: { userId: true, value: true } },
      attempts: { select: { userId: true, correct: true, total: true, passed: true } },
    },
  });
  const out: QuizSummary[] = rows.map((q) => {
    const mine = q.attempts.find((a) => a.userId === userId);
    return {
      id: q.id,
      focus: q.focus,
      author: firstName(q.author.name),
      mine: q.authorId === userId,
      score: q.ratings.reduce((s, r) => s + r.value, 0),
      myRating: q.ratings.find((r) => r.userId === userId)?.value ?? 0,
      canRate: !!mine?.passed && q.authorId !== userId,
      passers: q.attempts.filter((a) => a.passed).length,
      myAttempt: mine ? { correct: mine.correct, total: mine.total, passed: mine.passed } : null,
      createdAt: q.createdAt.toISOString(),
    };
  });
  // Best challenges float to the top: rating, then how many people passed, then newest.
  out.sort((a, b) => b.score - a.score || b.passers - a.passers || b.createdAt.localeCompare(a.createdAt));
  return out;
}

export type QuizQuestionView = {
  id: string;
  text: string;
  options: string[];
  voided: boolean;
  reviewed: boolean;
  /** Only present once the viewer has attempted the quiz (or wrote it). */
  correctIndex?: number;
  explanation?: string;
  myAnswer?: number;
};
export type QuizView = {
  id: string;
  focus: string;
  reveal: boolean;
  questions: QuizQuestionView[];
  myAttempt: { correct: number; total: number; passed: boolean } | null;
};

export async function getQuiz(userId: string, quizId: string): Promise<QuizView> {
  const q = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: { orderBy: { position: "asc" }, include: { review: { select: { id: true } } } },
      attempts: { where: { userId } },
    },
  });
  if (!q) throw new QaError(404, "NOT_FOUND", "Quiz not found.");
  const attempt = q.attempts[0];
  const reveal = !!attempt || q.authorId === userId;
  return {
    id: q.id,
    focus: q.focus,
    reveal,
    myAttempt: attempt ? { correct: attempt.correct, total: attempt.total, passed: attempt.passed } : null,
    questions: q.questions.map((x, i) => ({
      id: x.id,
      text: x.text,
      options: x.options,
      voided: x.voided,
      reviewed: !!x.review,
      ...(reveal ? { correctIndex: x.correctIndex, explanation: x.explanation } : {}),
      ...(attempt ? { myAnswer: attempt.answers[i] } : {}),
    })),
  };
}

// ─── Writing ────────────────────────────────────────────────────────────────

export async function createQuiz(userId: string, slug: string, rawFocus: unknown) {
  const focus = typeof rawFocus === "string" ? rawFocus.trim() : "";
  if (focus.length > 100) throw new QaError(400, "TOO_LONG", "The focus must be at most 100 characters.");
  const node = await prisma.node.findUnique({ where: { slug }, select: { id: true, retiredAt: true } });
  if (!node || node.retiredAt) throw new QaError(404, "NOT_FOUND", "Node not found.");
  const made = await prisma.quiz.count({ where: { authorId: userId, createdAt: { gte: new Date(Date.now() - DAY) } } });
  if (made >= LIMITS.quiz)
    throw new QaError(429, "RATE_LIMITED", "You can create 3 quizzes a day. Please try again tomorrow.");

  let qs;
  try {
    qs = await aiGenerateQuiz(await nodeContext(node.id), focus);
  } catch (e) {
    if (e instanceof AiUnavailableError) throw new QaError(503, "AI_UNAVAILABLE", "The AI could not write a quiz right now. Try again later.");
    throw e;
  }
  const quiz = await prisma.quiz.create({
    data: {
      nodeId: node.id,
      authorId: userId,
      focus,
      questions: {
        create: qs.map((q, position) => {
          // Shuffle so the key is not always where the model likes to put it.
          const order = shuffle([0, 1, 2, 3]);
          return {
            position,
            text: q.text,
            options: order.map((i) => q.options[i]),
            correctIndex: order.indexOf(q.correctIndex),
            explanation: q.explanation,
          };
        }),
      },
    },
    select: { id: true },
  });
  return { id: quiz.id };
}

export async function attemptQuiz(userId: string, quizId: string, rawAnswers: unknown) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, include: { questions: { orderBy: { position: "asc" } } } });
  if (!quiz) throw new QaError(404, "NOT_FOUND", "Quiz not found.");
  if (quiz.authorId === userId) throw new QaError(403, "OWN_QUIZ", "You cannot take a quiz you created.");
  const answers = rawAnswers;
  if (
    !Array.isArray(answers) ||
    answers.length !== quiz.questions.length ||
    !answers.every((a) => Number.isInteger(a) && a >= 0 && a <= 3)
  )
    throw new QaError(400, "BAD_ANSWERS", "Answer every question.");

  const counted = quiz.questions.filter((q) => !q.voided);
  const correct = counted.filter((q) => answers[q.position] === q.correctIndex).length;
  const total = counted.length;
  const passed = total > 0 && correct >= passMark(total);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.quizAttempt.create({ data: { quizId, userId, answers: answers as number[], correct, total, passed } });
      if (passed) {
        await grantHold(tx, userId, quiz.nodeId);
      } else {
        // Failing thins a node you hold. You cannot thin what you never held.
        await tx.holding.updateMany({
          where: { userId, nodeId: quiz.nodeId, state: "HELD" },
          data: { state: "THIN", thinCause: "quiz" },
        });
      }
    });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") throw new QaError(409, "ALREADY_ATTEMPTED", "You have already taken this quiz.");
    throw e;
  }
  return {
    correct, total, passed, passMark: passMark(total),
    results: quiz.questions.map((q, i) => ({
      id: q.id, voided: q.voided, myAnswer: answers[i] as number, correctIndex: q.correctIndex, explanation: q.explanation,
    })),
  };
}

/** value: 1, -1, or 0 to withdraw. Only people who passed the quiz can rate it. */
export async function rateQuiz(userId: string, quizId: string, value: unknown) {
  if (value !== 1 && value !== -1 && value !== 0) throw new QaError(400, "BAD_VALUE", "value must be 1, -1 or 0.");
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { authorId: true } });
  if (!quiz) throw new QaError(404, "NOT_FOUND", "Quiz not found.");
  if (quiz.authorId === userId) throw new QaError(403, "OWN_CONTENT", "You cannot rate your own quiz.");
  const attempt = await prisma.quizAttempt.findUnique({ where: { quizId_userId: { quizId, userId } }, select: { passed: true } });
  if (!attempt?.passed) throw new QaError(403, "MUST_PASS", "You can rate a quiz once you have passed it.");
  if (value === 0) await prisma.quizRating.deleteMany({ where: { quizId, userId } });
  else
    await prisma.quizRating.upsert({
      where: { quizId_userId: { quizId, userId } },
      update: { value },
      create: { quizId, userId, value },
    });
}

/**
 * Challenge a question's answer key. Only people who have seen the key (took the
 * quiz, or wrote it) can. The AI re-checks once and that is final. Attempts
 * already graded are not re-graded.
 */
export async function reviewQuizQuestion(userId: string, questionId: string, rawExplanation: unknown) {
  const explanation = typeof rawExplanation === "string" ? rawExplanation.trim() : "";
  if (explanation.length < 10) throw new QaError(400, "TOO_SHORT", "Your explanation must be at least 10 characters.");
  if (explanation.length > 1000) throw new QaError(400, "TOO_LONG", "Your explanation must be at most 1000 characters.");
  const q = await prisma.quizQuestion.findUnique({ where: { id: questionId }, include: { quiz: true, review: { select: { id: true } } } });
  if (!q) throw new QaError(404, "NOT_FOUND", "Question not found.");
  const saw = q.quiz.authorId === userId || !!(await prisma.quizAttempt.findUnique({ where: { quizId_userId: { quizId: q.quizId, userId } }, select: { id: true } }));
  if (!saw) throw new QaError(403, "TAKE_FIRST", "Take the quiz before challenging a question.");
  if (q.review) throw new QaError(409, "ALREADY_REVIEWED", "This question has already been re-checked.");
  const n = await prisma.quizQuestionReview.count({ where: { userId, createdAt: { gte: new Date(Date.now() - DAY) } } });
  if (n >= LIMITS.review) throw new QaError(429, "RATE_LIMITED", "You are doing that too fast. Please try again later.");

  let r;
  try {
    r = await aiReviewQuizKey(await nodeContext(q.quiz.nodeId), q, explanation);
  } catch (e) {
    if (e instanceof AiUnavailableError) throw new QaError(503, "AI_UNAVAILABLE", "The AI is unavailable. Try again later.");
    throw e;
  }
  const outcome = r.verdict === "KEY_OK" ? "UPHELD" : r.verdict === "KEY_WRONG" ? "KEY_FIXED" : "VOIDED";
  await prisma.$transaction([
    prisma.quizQuestionReview.create({ data: { questionId, userId, explanation, outcome, aiReason: r.reason } }),
    ...(outcome === "KEY_FIXED"
      ? [prisma.quizQuestion.update({ where: { id: questionId }, data: { correctIndex: r.correctIndex! } })]
      : outcome === "VOIDED"
        ? [prisma.quizQuestion.update({ where: { id: questionId }, data: { voided: true } })]
        : []),
  ]);
  return { outcome, reason: r.reason };
}
