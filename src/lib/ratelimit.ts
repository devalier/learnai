import { prisma } from "./db";

/**
 * Fixed-window rate limiting backed by Postgres, so the count is shared across
 * instances and survives restarts. The increment is a single atomic upsert.
 */

export type Limit = { max: number; windowMs: number };

/**
 * Count one hit on `key`; true if it is over the limit.
 * Every call counts, including ones that are refused.
 */
export async function hit(key: string, { max, windowMs }: Limit): Promise<boolean> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < ${cutoff} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < ${cutoff} THEN ${now} ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;
  // Sweep stale rows now and then; no job needed.
  if (Math.random() < 0.01)
    void prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } }).catch(() => {});
  return rows[0].count > max;
}

/** Forget a key (e.g. the per-account counter after a successful login). */
export async function reset(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
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
