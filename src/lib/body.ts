import { NextResponse } from "next/server";

/**
 * Reading and checking request bodies.
 *
 * Route handlers have no body size limit of their own, so `req.json()` will
 * buffer and parse whatever it is sent. `readBody` reads at most `max` bytes
 * (counting what actually arrives, so a chunked upload with no Content-Length
 * is capped too) and always yields a plain object or a ready 4xx response.
 */

export const MAX_BODY = 32 * 1024;
export type Body = Record<string, unknown>;

const err = (status: number, error: string, message: string) => ({ res: NextResponse.json({ error, message }, { status }) });

export async function readBody(req: Request, max = MAX_BODY): Promise<{ body: Body } | { res: NextResponse }> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return err(413, "TOO_LARGE", "That request is too large.");
  const reader = req.body?.getReader();
  if (!reader) return { body: {} };
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return err(413, "TOO_LARGE", "That request is too large.");
    }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return { body: {} }; // an empty body is an empty object; the handler decides what is required
  try {
    const v: unknown = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v)) return { body: v as Body };
  } catch {}
  return err(400, "BAD_JSON", "The request body must be a JSON object.");
}

/** A string of at most `max` characters, or undefined. Anything else (object, number, too long) is not a string here. */
export const str = (x: unknown, max = 200): string | undefined => (typeof x === "string" && x.length <= max ? x : undefined);

/** Control characters out, whitespace collapsed: for names and other single-line text. */
export const oneLine = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
