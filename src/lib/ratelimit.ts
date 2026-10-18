import { createHmac } from "node:crypto";
import { prisma } from "./db";

/**
 * Fixed-window rate limiting backed by Postgres, so the count is shared across
 * instances and survives restarts. The increment is a single atomic upsert.
 *
 * Callers pass a readable key such as `login:ip:203.0.113.7`, but what is stored
 * is a keyed hash of it (HMAC-SHA256 under AUTH_SECRET, label "ratelimit:v1:").
 * The table therefore holds no IP address, email address or user id, and a plain
 * hash would not do: there are only 2^32 IPv4 addresses, so an unkeyed hash is
 * reversible by trying them all. Rotating AUTH_SECRET only resets the counters.
 */

export type Limit = { max: number; windowMs: number };

function digest(key: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update("ratelimit:v1:" + key).digest("hex");
}

// The longest window any caller uses is one day, so a row older than that can never count again.
const KEEP_MS = 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 10 * 60 * 1000;
let lastSweep = 0;

/**
 * Delete rows that can no longer matter, at most every ten minutes per process.
 * It also removes any row whose key is not a hash: those were written by the first
 * version of this limiter, which stored the IP or email in the clear.
 */
function sweep(now: Date) {
  if (now.getTime() - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now.getTime();
  void prisma
    .$executeRaw`DELETE FROM "RateLimit" WHERE "windowStart" < ${new Date(now.getTime() - KEEP_MS)} OR "key" !~ '^[0-9a-f]{64}$'`
    .catch(() => {});
}

/**
 * Count one hit on `key`; true if it is over the limit.
 * Every call counts, including ones that are refused.
 */
export async function hit(key: string, { max, windowMs }: Limit): Promise<boolean> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  const id = digest(key);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${id}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < ${cutoff} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < ${cutoff} THEN ${now} ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;
  sweep(now);
  return rows[0].count > max;
}

/** Forget a key (e.g. the per-account counter after a successful login). */
export async function reset(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key: digest(key) } });
}

/**
 * Best-effort client address. Takes the rightmost X-Forwarded-For entry: the
 * one appended by the nearest proxy. The leftmost is whatever the client sent
 * and is trivially spoofed. Assumes exactly one trusted proxy in front.
 */
export function clientIp(req: Request): string {
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return xff[xff.length - 1] || req.headers.get("x-real-ip")?.trim() || "unknown";
}

export const TOO_MANY = { error: "Too many attempts. Please try again later." };
