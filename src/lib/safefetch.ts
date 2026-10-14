import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import https from "node:https";

/**
 * Fetch a user-supplied URL without becoming an SSRF gadget.
 *
 * - https only, standard port, no credentials, a real domain name (no IP literals)
 * - every address the name resolves to must be public; the check runs inside the
 *   socket's own `lookup`, so the address checked is the address connected to
 *   (no DNS-rebinding gap)
 * - redirects are followed by hand (max 3) and each hop goes through the same checks
 * - hard caps on time and bytes; the body is only ever read as text for an AI to
 *   look at, never rendered or executed
 */

export type FetchedPage = {
  finalUrl: string;
  status: number;
  contentType: string;
  title: string;
  description: string;
  text: string;
};

export class SourceFetchError extends Error {
  name = "SourceFetchError";
}

/** Name-based so it holds even if the class is loaded twice by a bundler or test runner. */
export const isSourceFetchError = (e: unknown): e is SourceFetchError => (e as Error | null)?.name === "SourceFetchError";

/** True only for globally routable unicast addresses. */
export function isPublicIp(ip: string): boolean {
  const fam = isIP(ip);
  if (fam === 4) {
    const [a, b, c] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    if (a === 169 && b === 254) return false; // link-local, cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a === 198 && b === 51 && c === 100) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    if (a >= 224) return false; // multicast, reserved, broadcast
    return true;
  }
  if (fam === 6) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicIp(mapped[1]);
    if (lower === "::" || lower === "::1") return false;
    if (/^f[cd]/.test(lower)) return false; // unique local
    if (/^fe[89ab]/.test(lower)) return false; // link-local
    if (/^ff/.test(lower)) return false; // multicast
    if (lower.startsWith("2001:db8")) return false; // documentation
    if (lower.startsWith("64:ff9b")) return false; // NAT64 can embed private v4
    return true;
  }
  return false;
}

export function checkSourceUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SourceFetchError("That is not a valid URL.");
  }
  if (u.protocol !== "https:") throw new SourceFetchError("The source must be an https link.");
  if (u.username || u.password) throw new SourceFetchError("The link must not contain a username or password.");
  if (u.port && u.port !== "443") throw new SourceFetchError("The link must use the standard https port.");
  const host = u.hostname.toLowerCase();
  if (isIP(host) || host.startsWith("[")) throw new SourceFetchError("Use a web address with a domain name, not an IP address.");
  if (host.length > 253 || !host.includes(".") || /(^|\.)(localhost|local|internal|localdomain|home|lan)$/.test(host))
    throw new SourceFetchError("That address is not a public website.");
  return u;
}

type Opts = {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  // Test seams. Production never sets these.
  resolve?: (host: string) => Promise<{ address: string; family: number }[]>;
  isPublic?: (ip: string) => boolean;
  rejectUnauthorized?: boolean;
};

function once(u: URL, o: Required<Pick<Opts, "maxBytes" | "timeoutMs">> & Opts) {
  const resolve = o.resolve ?? ((h: string) => dnsLookup(h, { all: true, verbatim: true }));
  const isPublic = o.isPublic ?? isPublicIp;
  return new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }>((ok, fail) => {
    const req = https.request(
      {
        host: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: "GET",
        servername: u.hostname,
        timeout: o.timeoutMs,
        rejectUnauthorized: o.rejectUnauthorized ?? true,
        headers: { "User-Agent": "learnai-source-check/1.0", Accept: "text/html,text/plain;q=0.9,*/*;q=0.1", "Accept-Encoding": "identity" },
        // Runs for the connection itself: validate every candidate address here.
        lookup: (host, options, cb) => {
          resolve(host).then(
            (addrs) => {
              if (addrs.length === 0 || addrs.some((a) => !isPublic(a.address)))
                return cb(new SourceFetchError("That address is not a public website.") as NodeJS.ErrnoException, "", 4);
              if ((options as { all?: boolean }).all) (cb as unknown as (e: null, a: unknown) => void)(null, addrs.map((a) => ({ address: a.address, family: a.family })));
              else cb(null, addrs[0].address, addrs[0].family);
            },
            (e) => cb(e as NodeJS.ErrnoException, "", 4)
          );
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (d: Buffer) => {
          size += d.length;
          if (size <= o.maxBytes) chunks.push(d);
          else res.destroy(); // enough to judge; do not download the rest
        });
        const done = () => ok({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).subarray(0, o.maxBytes) });
        res.on("end", done);
        res.on("close", done);
        res.on("error", fail);
      }
    );
    req.on("timeout", () => req.destroy(new SourceFetchError("The source took too long to respond.")));
    req.on("error", (e) => fail(isSourceFetchError(e) ? e : new SourceFetchError("The source could not be reached.")));
    req.end();
  });
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (m) => ENTITIES[m] ?? m);

function meta(html: string, key: string): string {
  const m =
    html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i")) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${key}["']`, "i"));
  return m ? decode(m[1]).trim() : "";
}

export function htmlToText(html: string): { title: string; description: string; text: string } {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ")).trim() || meta(html, "og:title");
  const description = meta(html, "og:description") || meta(html, "description");
  const text = decode(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
  return { title: title.slice(0, 200), description: description.slice(0, 400), text: text.slice(0, 6000) };
}

export async function fetchPublicPage(raw: string, opts: Opts = {}): Promise<FetchedPage> {
  const o = { maxBytes: 400_000, timeoutMs: 8_000, maxRedirects: 3, ...opts };
  let url = checkSourceUrl(raw);
  for (let hop = 0; hop <= o.maxRedirects; hop++) {
    const r = await once(url, o);
    if (r.status >= 300 && r.status < 400 && r.headers.location) {
      if (hop === o.maxRedirects) throw new SourceFetchError("The link redirects too many times.");
      url = checkSourceUrl(new URL(String(r.headers.location), url).toString());
      continue;
    }
    const contentType = String(r.headers["content-type"] ?? "").toLowerCase();
    const isText = /^(text\/|application\/xhtml)/.test(contentType) || contentType === "";
    const parsed = isText ? htmlToText(r.body.toString("utf8")) : { title: "", description: "", text: "" };
    return { finalUrl: url.toString(), status: r.status, contentType, ...parsed };
  }
  throw new SourceFetchError("The link redirects too many times.");
}
