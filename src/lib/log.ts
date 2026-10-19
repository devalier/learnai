/**
 * Structured logging: one JSON object per line on stdout (stderr for errors), so a log
 * shipper or `journalctl -o cat | jq` can read it. No dependency.
 *
 *   logger.info("startup", { port: 3000 });
 *   logger.error("login_failed", { ...errorFields(e) }, req);   // req adds its request id
 *
 * Never log a secret, a password, a token, an email address or a request body. Field
 * names that look like secrets are redacted and email addresses in any string are
 * replaced, as a backstop and not as permission.
 */

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SECRETISH = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|hash/i;

function threshold(): number {
  const l = (process.env.LOG_LEVEL ?? "info").toLowerCase() as Level;
  return ORDER[l] ?? ORDER.info;
}

const EMAIL = /[^\s@<>"',;()]+@[^\s@<>"',;()]+\.[^\s@<>"',;()]+/g;
/** Error messages from the database driver and from SMTP servers can quote an address. */
const scrub = (s: string) => s.replace(EMAIL, "[email]");

function clean(v: unknown, depth = 0): unknown {
  if (typeof v === "string") return scrub(v.length > 500 ? v.slice(0, 500) + "…" : v);
  if (v instanceof Error) return errorFields(v);
  if (Array.isArray(v)) return depth > 2 ? "[array]" : v.slice(0, 20).map((x) => clean(x, depth + 1));
  if (v && typeof v === "object") {
    if (depth > 2) return "[object]";
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = SECRETISH.test(k) ? "[redacted]" : clean(x, depth + 1);
    return out;
  }
  return v;
}

/** The request id the proxy assigned, if a request is given. */
export const requestIdOf = (req?: Request) => req?.headers.get("x-request-id") ?? undefined;

export function errorFields(e: unknown): { error: string; message: string; stack?: string } {
  const err = e instanceof Error ? e : new Error(String(e));
  return {
    error: err.name,
    message: scrub(err.message.slice(0, 500)),
    ...(process.env.NODE_ENV !== "production" ? { stack: err.stack?.slice(0, 2000) } : {}),
  };
}

function write(level: Level, event: string, fields: Record<string, unknown> = {}, req?: Request) {
  if (ORDER[level] < threshold()) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, requestId: requestIdOf(req), ...(clean(fields) as object) });
  (level === "error" || level === "warn" ? console.error : console.log)(line);
}

export const logger = {
  debug: (event: string, fields?: Record<string, unknown>, req?: Request) => write("debug", event, fields, req),
  info: (event: string, fields?: Record<string, unknown>, req?: Request) => write("info", event, fields, req),
  warn: (event: string, fields?: Record<string, unknown>, req?: Request) => write("warn", event, fields, req),
  error: (event: string, fields?: Record<string, unknown>, req?: Request) => write("error", event, fields, req),
};
