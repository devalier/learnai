import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runDecay } from "@/lib/holdings";

export const dynamic = "force-dynamic";

/** Constant-time string comparison (avoids leaking the secret via timing). */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Runs the nightly holdings-decay job (held→thin). Guarded by a shared secret
 * header so it can be wired to a cron/scheduler. An ADMIN could equally trigger
 * it, but this keeps the job callable without a browser session.
 *
 *   curl -X POST -H "x-job-secret: $JOB_SECRET" .../api/jobs/decay
 */
export async function POST(req: Request) {
  const secret = process.env.JOB_SECRET;
  if (!secret) return NextResponse.json({ error: "JOB_SECRET not configured" }, { status: 503 });
  if (!safeEqual(req.headers.get("x-job-secret") ?? "", secret))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const result = await runDecay();
  return NextResponse.json({ ok: true, ...result });
}
