import { prisma } from "./db";

/**
 * Account housekeeping: who has been around, and who has not.
 *
 * Three recorded signals (User.lastLoginAt, lastSeenAt, loginCount) plus a derived
 * one: the newest thing the account actually did (a tick, a hold, a post, a vote).
 * The derived signal matters because tracking only starts when this ships, and
 * because a 30-day session means someone can use the site daily without signing in.
 */

export const ACTIVE_DAYS = 30;
export const QUIET_DAYS = 90;
export const NEVER_STARTED_AFTER_DAYS = 14;

export type Status = "active" | "quiet" | "stale" | "never_started";

export type Signals = {
  createdAt: Date;
  lastLoginAt: Date | null;
  lastSeenAt: Date | null;
  loginCount: number;
  /** newest thing the account did, from the content tables; null if it never did anything */
  lastActivityAt: Date | null;
};

const DAY = 24 * 60 * 60 * 1000;
export const daysBetween = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / DAY);

/** The most recent sign of life, falling back to the day the account was made. */
export function lastSignal(s: Signals): Date {
  return [s.lastSeenAt, s.lastLoginAt, s.lastActivityAt, s.createdAt]
    .filter((d): d is Date => !!d)
    .reduce((a, b) => (b > a ? b : a));
}

/**
 *  never_started  old enough, signed in at most once, and never did anything
 *  active         seen or active within 30 days
 *  quiet          31 to 90 days
 *  stale          more than 90 days
 */
export function classify(s: Signals, now: Date = new Date()): Status {
  const age = daysBetween(now, s.createdAt);
  if (age > NEVER_STARTED_AFTER_DAYS && s.loginCount <= 1 && !s.lastActivityAt) return "never_started";
  const idle = daysBetween(now, lastSignal(s));
  if (idle <= ACTIVE_DAYS) return "active";
  if (idle <= QUIET_DAYS) return "quiet";
  return "stale";
}

export type AccountRow = Signals & {
  id: string;
  name: string;
  email: string;
  role: string;
  socialOn: boolean;
  ticks: number;
  holds: number;
  posts: number;
  status: Status;
  idleDays: number;
};

const toMap = <T,>(rows: T[], key: (r: T) => string, at: (r: T) => Date | null | undefined) => {
  const m = new Map<string, Date>();
  for (const r of rows) { const d = at(r); if (d) m.set(key(r), d); }
  return m;
};
const newest = (...ms: (Date | undefined)[]) => ms.filter((d): d is Date => !!d).reduce<Date | null>((a, b) => (!a || b > a ? b : a), null);

export async function listAccounts(now: Date = new Date()): Promise<AccountRow[]> {
  const [users, prog, hold, qs, as, zs, att, vs, rv] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, presenceOptIn: true, createdAt: true, lastLoginAt: true, lastSeenAt: true, loginCount: true } }),
    prisma.progress.groupBy({ by: ["userId"], _max: { updatedAt: true }, _count: { _all: true }, where: { completed: true } }),
    prisma.holding.groupBy({ by: ["userId"], _count: { _all: true } }),
    prisma.question.groupBy({ by: ["authorId"], _max: { createdAt: true }, _count: { _all: true } }),
    prisma.answer.groupBy({ by: ["authorId"], _max: { createdAt: true }, _count: { _all: true } }),
    prisma.quiz.groupBy({ by: ["authorId"], _max: { createdAt: true }, _count: { _all: true } }),
    prisma.quizAttempt.groupBy({ by: ["userId"], _max: { createdAt: true } }),
    prisma.vote.groupBy({ by: ["userId"], _max: { createdAt: true } }),
    prisma.resourceVote.groupBy({ by: ["userId"], _max: { createdAt: true } }),
  ]);
  const progMax = toMap(prog, (r) => r.userId, (r) => r._max.updatedAt);
  const qMax = toMap(qs, (r) => r.authorId, (r) => r._max.createdAt);
  const aMax = toMap(as, (r) => r.authorId, (r) => r._max.createdAt);
  const zMax = toMap(zs, (r) => r.authorId, (r) => r._max.createdAt);
  const tMax = toMap(att, (r) => r.userId, (r) => r._max.createdAt);
  const vMax = toMap(vs, (r) => r.userId, (r) => r._max.createdAt);
  const rMax = toMap(rv, (r) => r.userId, (r) => r._max.createdAt);
  const cnt = <T extends { _count: { _all: number } }>(rows: T[], key: (r: T) => string) => new Map(rows.map((r) => [key(r), r._count._all]));
  const ticks = cnt(prog, (r) => r.userId), holds = cnt(hold, (r) => r.userId);
  const nQ = cnt(qs, (r) => r.authorId), nA = cnt(as, (r) => r.authorId), nZ = cnt(zs, (r) => r.authorId);

  return users.map((u) => {
    const lastActivityAt = newest(progMax.get(u.id), qMax.get(u.id), aMax.get(u.id), zMax.get(u.id), tMax.get(u.id), vMax.get(u.id), rMax.get(u.id));
    const sig: Signals = { createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, lastSeenAt: u.lastSeenAt, loginCount: u.loginCount, lastActivityAt };
    return {
      id: u.id, name: u.name, email: u.email, role: u.role, socialOn: u.presenceOptIn, ...sig,
      ticks: ticks.get(u.id) ?? 0, holds: holds.get(u.id) ?? 0,
      posts: (nQ.get(u.id) ?? 0) + (nA.get(u.id) ?? 0) + (nZ.get(u.id) ?? 0),
      status: classify(sig, now),
      idleDays: daysBetween(now, lastSignal(sig)),
    };
  });
}

/** Spreadsheet-safe cell: a value that starts with = + - @ could run as a formula. */
const cell = (v: unknown) => {
  let s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: AccountRow[]): string {
  const head = ["name", "email", "role", "status", "idle_days", "created", "last_login", "last_seen", "last_activity", "logins", "ticks", "holds", "posts", "social"];
  const lines = rows.map((r) =>
    [r.name, r.email, r.role, r.status, r.idleDays, r.createdAt, r.lastLoginAt, r.lastSeenAt, r.lastActivityAt, r.loginCount, r.ticks, r.holds, r.posts, r.socialOn ? "yes" : "no"].map(cell).join(",")
  );
  return [head.join(","), ...lines].join("\n") + "\n";
}
