import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorFields, logger } from "@/lib/log";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * For a load balancer, an uptime monitor or systemd.
 *   GET /api/health          readiness: 200 only if the database answers within 2 s, else 503
 *   GET /api/health?live=1   liveness: 200 if the process is serving, no database
 * No authentication, and nothing in the body that helps an attacker.
 */
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("live") === "1") return NextResponse.json({ status: "ok" }, { headers: NO_STORE });
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("database check timed out")), 2000)),
    ]);
    return NextResponse.json({ status: "ok" }, { headers: NO_STORE });
  } catch (e) {
    logger.error("health_check_failed", errorFields(e), req);
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}
