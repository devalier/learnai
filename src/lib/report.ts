import type { ReportReason } from "@prisma/client";
import { prisma } from "./db";
import { QaError } from "./qa";
import { reconcile } from "./reconcile";

/**
 * Reporting and moderation. Any opted-in user can report a question, an answer
 * or a quiz (not their own). Three different people reporting the same post hides
 * it automatically until an admin decides; an admin can also hide or restore any
 * post. Hidden posts disappear for everyone but their author, who sees them
 * flagged, and they stop counting toward holds, stakes and points.
 */

export const AUTO_HIDE_AT = 3;
const REASONS = new Set<ReportReason>(["ABUSE", "SPAM", "OFF_TOPIC", "PERSONAL_DATA", "OTHER"]);
const DAY = 24 * 60 * 60 * 1000;
const DAILY_LIMIT = 10;

export type Kind = "question" | "answer" | "quiz";
const isKind = (k: unknown): k is Kind => k === "question" || k === "answer" || k === "quiz";

type Target = { authorId: string; nodeId: string; hiddenAt: Date | null };

async function loadTarget(kind: Kind, id: string): Promise<Target | null> {
  if (kind === "question") return prisma.question.findUnique({ where: { id }, select: { authorId: true, nodeId: true, hiddenAt: true } });
  if (kind === "quiz") return prisma.quiz.findUnique({ where: { id }, select: { authorId: true, nodeId: true, hiddenAt: true } });
  const a = await prisma.answer.findUnique({ where: { id }, select: { authorId: true, hiddenAt: true, question: { select: { nodeId: true } } } });
  return a ? { authorId: a.authorId, nodeId: a.question.nodeId, hiddenAt: a.hiddenAt } : null;
}

const fk = (kind: Kind, id: string) => (kind === "question" ? { questionId: id } : kind === "answer" ? { answerId: id } : { quizId: id });

async function setHidden(kind: Kind, id: string, hiddenBy: "ADMIN" | "AUTO" | "") {
  const data = hiddenBy ? { hiddenAt: new Date(), hiddenBy } : { hiddenAt: null, hiddenBy: "" };
  if (kind === "question") await prisma.question.update({ where: { id }, data });
  else if (kind === "quiz") await prisma.quiz.update({ where: { id }, data });
  else await prisma.answer.update({ where: { id }, data });
}

export async function createReport(userId: string, input: { kind: unknown; id: unknown; reason: unknown; note: unknown }) {
  if (!isKind(input.kind) || typeof input.id !== "string") throw new QaError(400, "BAD_TARGET", "Choose a question, answer or quiz to report.");
  if (!REASONS.has(input.reason as ReportReason)) throw new QaError(400, "BAD_REASON", "Choose a reason.");
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 300) : "";
  if (input.reason === "OTHER" && note.length < 5) throw new QaError(400, "NOTE_REQUIRED", "Please say what is wrong.");

  const t = await loadTarget(input.kind, input.id);
  if (!t) throw new QaError(404, "NOT_FOUND", "That post no longer exists.");
  if (t.authorId === userId) throw new QaError(403, "OWN_CONTENT", "You cannot report your own post.");
  const recent = await prisma.report.count({ where: { reporterId: userId, createdAt: { gte: new Date(Date.now() - DAY) } } });
  if (recent >= DAILY_LIMIT) throw new QaError(429, "RATE_LIMITED", "You are doing that too fast. Please try again later.");

  try {
    await prisma.report.create({ data: { reporterId: userId, reason: input.reason as ReportReason, note, ...fk(input.kind, input.id) } });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") throw new QaError(409, "ALREADY_REPORTED", "You have already reported this post.");
    throw e;
  }

  let hidden = !!t.hiddenAt;
  if (!hidden) {
    const open = await prisma.report.count({ where: { ...fk(input.kind, input.id), status: "OPEN" } });
    if (open >= AUTO_HIDE_AT) {
      await setHidden(input.kind, input.id, "AUTO");
      await reconcile(t.authorId, t.nodeId);
      hidden = true;
    }
  }
  return { hidden };
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export type ReportItem = {
  kind: Kind;
  id: string;
  text: string;
  author: string;
  node: string;
  hidden: boolean;
  hiddenBy: string;
  reports: { reason: ReportReason; note: string; reporter: string; createdAt: string }[];
};

/** Posts with open reports, most reported first. */
export async function listOpenReports(): Promise<ReportItem[]> {
  const rows = await prisma.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    include: {
      reporter: { select: { name: true } },
      question: { select: { id: true, text: true, hiddenAt: true, hiddenBy: true, author: { select: { name: true } }, node: { select: { title: true } } } },
      answer: { select: { id: true, text: true, hiddenAt: true, hiddenBy: true, author: { select: { name: true } }, question: { select: { node: { select: { title: true } } } } } },
      quiz: { select: { id: true, focus: true, hiddenAt: true, hiddenBy: true, author: { select: { name: true } }, node: { select: { title: true } } } },
    },
  });
  const byKey = new Map<string, ReportItem>();
  for (const r of rows) {
    let key: string, base: Omit<ReportItem, "reports">;
    if (r.question) { key = "q" + r.question.id; base = { kind: "question", id: r.question.id, text: r.question.text, author: r.question.author.name, node: r.question.node.title, hidden: !!r.question.hiddenAt, hiddenBy: r.question.hiddenBy }; }
    else if (r.answer) { key = "a" + r.answer.id; base = { kind: "answer", id: r.answer.id, text: r.answer.text, author: r.answer.author.name, node: r.answer.question.node.title, hidden: !!r.answer.hiddenAt, hiddenBy: r.answer.hiddenBy }; }
    else if (r.quiz) { key = "z" + r.quiz.id; base = { kind: "quiz", id: r.quiz.id, text: r.quiz.focus ? `Quiz focus: ${r.quiz.focus}` : "Quiz (no focus)", author: r.quiz.author.name, node: r.quiz.node.title, hidden: !!r.quiz.hiddenAt, hiddenBy: r.quiz.hiddenBy }; }
    else continue;
    const item = byKey.get(key) ?? { ...base, reports: [] };
    item.reports.push({ reason: r.reason, note: r.note, reporter: r.reporter.name.trim().split(/\s+/)[0], createdAt: r.createdAt.toISOString() });
    byKey.set(key, item);
  }
  return [...byKey.values()].sort((a, b) => b.reports.length - a.reports.length);
}

/**
 * hide: hide it and mark its open reports as actioned.
 * restore: show it again and dismiss its reports.
 * dismiss: the reports were unfounded: dismiss them (and show it again if the
 *          reports had auto-hidden it).
 */
export async function moderate(kind: unknown, id: unknown, action: unknown) {
  if (!isKind(kind) || typeof id !== "string") throw new QaError(400, "BAD_TARGET", "Bad target.");
  if (action !== "hide" && action !== "restore" && action !== "dismiss") throw new QaError(400, "BAD_ACTION", "Bad action.");
  const t = await loadTarget(kind, id);
  if (!t) throw new QaError(404, "NOT_FOUND", "That post no longer exists.");
  const where = { ...fk(kind, id), status: "OPEN" as const };
  const now = new Date();
  if (action === "hide") {
    await setHidden(kind, id, "ADMIN");
    await prisma.report.updateMany({ where, data: { status: "ACTIONED", decidedAt: now } });
    await reconcile(t.authorId, t.nodeId);
  } else {
    if (t.hiddenAt) await setHidden(kind, id, "");
    await prisma.report.updateMany({ where, data: { status: "DISMISSED", decidedAt: now } });
  }
  return { ok: true };
}

/** Everything currently hidden, so an admin can restore it. */
export async function listHidden(): Promise<Omit<ReportItem, "reports">[]> {
  const [qs, as, zs] = await Promise.all([
    prisma.question.findMany({ where: { hiddenAt: { not: null } }, select: { id: true, text: true, hiddenBy: true, author: { select: { name: true } }, node: { select: { title: true } } } }),
    prisma.answer.findMany({ where: { hiddenAt: { not: null } }, select: { id: true, text: true, hiddenBy: true, author: { select: { name: true } }, question: { select: { node: { select: { title: true } } } } } }),
    prisma.quiz.findMany({ where: { hiddenAt: { not: null } }, select: { id: true, focus: true, hiddenBy: true, author: { select: { name: true } }, node: { select: { title: true } } } }),
  ]);
  return [
    ...qs.map((x) => ({ kind: "question" as const, id: x.id, text: x.text, author: x.author.name, node: x.node.title, hidden: true, hiddenBy: x.hiddenBy })),
    ...as.map((x) => ({ kind: "answer" as const, id: x.id, text: x.text, author: x.author.name, node: x.question.node.title, hidden: true, hiddenBy: x.hiddenBy })),
    ...zs.map((x) => ({ kind: "quiz" as const, id: x.id, text: x.focus ? `Quiz focus: ${x.focus}` : "Quiz (no focus)", author: x.author.name, node: x.node.title, hidden: true, hiddenBy: x.hiddenBy })),
  ];
}
