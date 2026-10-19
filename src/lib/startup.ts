import { logger } from "./log";

/**
 * Configuration checks, run once when the server starts (see instrumentation.ts).
 * In production a missing or weak secret is an error and the server refuses to start:
 * better a service that is visibly down than one that is quietly signing sessions with
 * a guessable key. Everything else is a warning in the log.
 */

export type Findings = { errors: string[]; warnings: string[] };

// Placeholders that have appeared in .env.example or in documentation.
const PLACEHOLDERS = new Set(["set-a-long-random-secret-on-the-server", "set-a-long-random-secret-for-cron", "changeme", "change-me", "secret"]);

/** Does any block of 8 or more characters occur twice? A random secret essentially never does. */
function repeats(v: string): boolean {
  for (let len = 8; len <= v.length / 2; len++) {
    const seen = new Set<string>();
    for (let i = 0; i + len <= v.length; i++) {
      const b = v.slice(i, i + len);
      if (seen.has(b)) return true;
      seen.add(b);
    }
  }
  return false;
}

/** A secret that is long enough and not obviously patterned or copied from an example. */
export function weakSecret(v: string): string | null {
  if (PLACEHOLDERS.has(v.toLowerCase())) return "it is a placeholder from the documentation";
  if (v.length < 32) return `it is ${v.length} characters; use at least 32 (openssl rand -base64 48)`;
  if (new Set(v).size < 8) return "it uses too few distinct characters to be random";
  if (repeats(v)) return "it repeats itself, so it is not random";
  return null;
}

export function checkEnvironment(env: Record<string, string | undefined> = process.env): Findings {
  const production = env.NODE_ENV === "production";
  const errors: string[] = [];
  const warnings: string[] = [];
  const problem = (msg: string) => (production ? errors : warnings).push(msg);

  if (!env.DATABASE_URL) problem("DATABASE_URL is not set.");

  if (!env.AUTH_SECRET) problem("AUTH_SECRET is not set: sessions cannot be signed.");
  else {
    const why = weakSecret(env.AUTH_SECRET);
    if (why) problem(`AUTH_SECRET is too weak: ${why}.`);
  }

  if (!env.JOB_SECRET) warnings.push("JOB_SECRET is not set: POST /api/jobs/decay is disabled, so holdings will never decay.");
  else {
    const why = weakSecret(env.JOB_SECRET);
    if (why) warnings.push(`JOB_SECRET is weak: ${why}.`);
  }

  if (!env.APP_URL) warnings.push("APP_URL is not set: emailed links and the cross-site request check fall back to https://learnai.devalier.com.");
  else if (production && !env.APP_URL.startsWith("https://")) warnings.push("APP_URL is not https.");

  if (!env.SMTP_HOST) warnings.push("SMTP_HOST is not set: password-reset emails cannot be sent.");
  if (!env.MISTRAL_API_KEY) warnings.push("MISTRAL_API_KEY is not set: the AI features are unavailable.");
  if (env.MISTRAL_BASE_URL && production) warnings.push("MISTRAL_BASE_URL is set: it is a test override and sends user text to that address.");
  if (env.CSP_REPORT_ONLY === "1") warnings.push("CSP_REPORT_ONLY=1: the Content-Security-Policy is reported, not enforced.");
  if (env.ADMIN_PASSWORD && production) warnings.push("ADMIN_PASSWORD is set in the running service's environment; it is only needed when seeding. Remove it.");

  return { errors, warnings };
}

/**
 * Log the findings and, if there is an error (production only), exit with status 1.
 * Throwing is not enough: Next prints "Failed to prepare server" and keeps the process
 * alive without listening, which a supervisor reads as healthy. An exit is seen as a failure.
 */
export function assertEnvironment(env: Record<string, string | undefined> = process.env): void {
  const { errors, warnings } = checkEnvironment(env);
  for (const w of warnings) logger.warn("config_warning", { message: w });
  for (const e of errors) logger.error("config_error", { message: e });
  if (errors.length) {
    logger.error("startup_refused", { errors: errors.length });
    process.exit(1);
  }
}
