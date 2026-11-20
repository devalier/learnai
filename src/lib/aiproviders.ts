import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * The AI providers an administrator can choose in /admin/ai, the same set as AISH:
 * Mistral, Anthropic, OpenAI, DeepSeek, Fireworks, OpenRouter, and any self-hosted
 * server speaking the OpenAI chat-completions API (vLLM, TGI, Ollama, llama.cpp).
 *
 * Every provider but the self-hosted one is called on its own fixed API address, so a
 * key entered for it can never be sent anywhere else.
 */

export type ProviderId = "mistral" | "anthropic" | "openai" | "deepseek" | "fireworks" | "openrouter" | "openai_compatible";

export type ProviderSpec = {
  label: string;
  /** Fixed API base; null for the self-hosted provider, whose endpoint is entered. */
  base: string | null;
  requiresKey: boolean;
  /** Whether the model list can be fetched without a key. */
  publicCatalog: boolean;
  /** Sends response_format: {type: "json_object"}. */
  jsonMode: boolean;
  /** Example model id, shown as a hint. */
  example: string;
  /** For the privacy notice: who receives users' text, and where. */
  processor: string;
  inEU: boolean;
};

export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  mistral: {
    label: "Mistral AI",
    base: "https://api.mistral.ai/v1",
    requiresKey: true,
    publicCatalog: false,
    jsonMode: true,
    example: "mistral-small-latest",
    processor: "Mistral AI, a company based in France, using its EU service",
    inEU: true,
  },
  anthropic: {
    label: "Anthropic (Claude)",
    base: "https://api.anthropic.com/v1",
    requiresKey: true,
    publicCatalog: false,
    jsonMode: false,
    example: "claude-sonnet-5-5",
    processor: "Anthropic PBC, a company based in the United States",
    inEU: false,
  },
  openai: {
    label: "OpenAI",
    base: "https://api.openai.com/v1",
    requiresKey: true,
    publicCatalog: false,
    jsonMode: true,
    example: "gpt-5.1",
    processor: "OpenAI, a company based in the United States",
    inEU: false,
  },
  deepseek: {
    label: "DeepSeek",
    base: "https://api.deepseek.com",
    requiresKey: true,
    publicCatalog: false,
    jsonMode: true,
    example: "deepseek-chat",
    processor: "DeepSeek, a company based in China",
    inEU: false,
  },
  fireworks: {
    label: "Fireworks AI",
    base: "https://api.fireworks.ai/inference/v1",
    requiresKey: true,
    publicCatalog: false,
    jsonMode: true,
    example: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    processor: "Fireworks AI, a company based in the United States",
    inEU: false,
  },
  openrouter: {
    label: "OpenRouter",
    base: "https://openrouter.ai/api/v1",
    requiresKey: true,
    publicCatalog: true,
    jsonMode: false,
    example: "mistralai/mistral-small-3.2-24b-instruct",
    processor:
      "OpenRouter, a company based in the United States, which passes it to the company hosting the chosen model; only hosts that do not store or train on it are used",
    inEU: false,
  },
  openai_compatible: {
    label: "Self-hosted / OpenAI-compatible endpoint",
    base: null,
    requiresKey: false,
    publicCatalog: false,
    jsonMode: false,
    example: "the model name your server serves",
    processor: "an AI model server run for us",
    inEU: true, // the operator's own server; the admin page says to check where it runs
  },
};

export const isProviderId = (p: unknown): p is ProviderId => typeof p === "string" && Object.hasOwn(PROVIDERS, p);

export class ProviderError extends Error {
  name = "ProviderError";
  constructor(message: string, public status?: number) {
    super(message);
  }
}

// ─── Endpoint safety (self-hosted only) ─────────────────────────────────────

/** Loopback, link-local (cloud metadata), multicast and unspecified are never allowed. */
function blockedIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 127 || (a === 169 && b === 254) || a >= 224;
  }
  const l = ip.toLowerCase();
  const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return blockedIp(mapped[1]);
  return l === "::" || l === "::1" || /^fe[89ab]/.test(l) || /^ff/.test(l);
}

function privateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  return /^f[cd]/.test(ip.toLowerCase());
}

/**
 * Vet a self-hosted endpoint before the server calls it. Private networks are allowed
 * (that is where on-prem models live); loopback, link-local and metadata addresses are
 * not, because those turn an endpoint field into a way to reach the server's own
 * services. Plain http only to private addresses, so a key never crosses the internet
 * in the clear. Runs at save time and again before every call.
 */
export async function checkEndpoint(raw: string): Promise<string> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new ProviderError("The endpoint is not a valid URL.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new ProviderError("The endpoint must use https (or http on a private network).");
  if (u.username || u.password) throw new ProviderError("Do not put credentials in the endpoint URL; use the key field.");
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal")
    throw new ProviderError("That endpoint host is not allowed.");
  let addrs: { address: string }[];
  try {
    addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  } catch {
    throw new ProviderError("The endpoint host does not resolve from this server.");
  }
  if (!addrs.length || addrs.some((a) => blockedIp(a.address))) throw new ProviderError("The endpoint resolves to an address that is not allowed (loopback, link-local or metadata).");
  if (u.protocol === "http:" && !addrs.every((a) => privateIp(a.address)))
    throw new ProviderError("Plain http is allowed only to a private network address; use https.");
  return u.toString().replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
}

async function baseFor(provider: ProviderId, endpoint: string): Promise<string> {
  const fixed = PROVIDERS[provider].base;
  if (fixed) return fixed;
  if (!endpoint.trim()) throw new ProviderError("A self-hosted model needs its endpoint URL.");
  return checkEndpoint(endpoint);
}

// ─── HTTP ───────────────────────────────────────────────────────────────────

const MAX_LIST_BYTES = 8_000_000;

async function http(url: string, init: RequestInit, timeoutMs: number): Promise<{ status: number; text: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, redirect: "error", signal: ctl.signal });
    const text = await res.text();
    if (text.length > MAX_LIST_BYTES) throw new ProviderError("The provider sent an oversized response.");
    return { status: res.status, text };
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(ctl.signal.aborted ? "The provider did not answer in time." : "The provider could not be reached.");
  } finally {
    clearTimeout(timer);
  }
}

function rejectStatus(status: number): void {
  if (status === 401 || status === 403) throw new ProviderError("The provider rejected the API key.", status);
  if (status === 404) throw new ProviderError("Not found at the provider (check the model or the endpoint).", status);
  if (status === 429) throw new ProviderError("The provider is rate limiting this key, or the account has no credit.", status);
  if (status >= 400) throw new ProviderError(`The provider returned ${status}.`, status);
}

function json(text: string): Record<string, unknown> {
  try {
    const v = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {}
  throw new ProviderError("The provider returned something that is not a model list.");
}

function authHeaders(provider: ProviderId, key: string): Record<string, string> {
  if (provider === "anthropic") return { "x-api-key": key, "anthropic-version": "2023-06-01" };
  return key ? { Authorization: `Bearer ${key}` } : {};
}

// ─── Model lists ────────────────────────────────────────────────────────────

export type ModelEntry = { id: string; label: string };

const ctx = (n: unknown) => (typeof n === "number" && n > 0 ? (n >= 1000 ? `${Math.round(n / 1000)}k context` : `${n} context`) : "");
const join = (...p: (string | false | undefined)[]) => p.filter(Boolean).join(" · ");
const rows = (b: Record<string, unknown>, k = "data") => (Array.isArray(b[k]) ? (b[k] as Record<string, unknown>[]) : []).filter((m) => m && typeof m === "object");

/** Not chat models: embeddings, speech, images, moderation. */
const NOT_CHAT = /embed|tts|whisper|dall-e|image|audio|realtime|transcribe|moderation|davinci|babbage|sora|ocr/i;

/** Pure: turn a provider's /models body into entries. Exported for tests. */
export function parseModels(provider: ProviderId, body: Record<string, unknown>): ModelEntry[] {
  switch (provider) {
    case "mistral":
      return rows(body)
        .filter((m) => (m.capabilities as { completion_chat?: boolean } | undefined)?.completion_chat !== false && !m.deprecation)
        .map((m) => ({ id: String(m.id), label: join(ctx(m.max_context_length)) }));
    case "anthropic":
      return rows(body).map((m) => ({ id: String(m.id), label: String(m.display_name ?? "") }));
    case "openrouter":
      return rows(body)
        .filter((m) => {
          const out = (m.architecture as { output_modalities?: string[] } | undefined)?.output_modalities;
          return !out || out.includes("text");
        })
        .map((m) => {
          const p = m.pricing as { prompt?: string; completion?: string } | undefined;
          const pin = Number(p?.prompt) * 1e6, pout = Number(p?.completion) * 1e6;
          const price = pin === 0 && pout === 0 ? "free" : Number.isFinite(pin) && Number.isFinite(pout) ? `$${pin.toFixed(2)} in / $${pout.toFixed(2)} out per 1M tokens` : "";
          return { id: String(m.id), label: join(String(m.name ?? ""), ctx(m.context_length), price) };
        });
    case "fireworks":
      return rows(body, "models")
        .filter((m) => m.supportsServerless !== false && !["EMBEDDING_MODEL", "DRAFT_ADDON", "FLUMINA_BASE_MODEL", "FLUMINA_ADDON"].includes(String(m.kind ?? "")))
        .map((m) => ({ id: String(m.name), label: join(String(m.displayName ?? ""), ctx(m.contextLength)) }));
    default:
      return rows(body)
        .filter((m) => !(provider === "openai" && NOT_CHAT.test(String(m.id))))
        .map((m) => ({ id: String(m.id), label: "" }));
  }
}

/** Models the given key can use, sorted by id. The key is used for this call only. */
export async function listModels(provider: ProviderId, key: string, endpoint: string): Promise<ModelEntry[]> {
  const spec = PROVIDERS[provider];
  if (spec.requiresKey && !key && !spec.publicCatalog) throw new ProviderError("Enter the API key first: the model list depends on it.");
  const headers = { Accept: "application/json", ...authHeaders(provider, key) };
  let entries: ModelEntry[] = [];
  if (provider === "fireworks") {
    let token = "";
    for (let page = 0; page < 10; page++) {
      const q = new URLSearchParams({ pageSize: "200", filter: "supports_serverless=true", ...(token ? { pageToken: token } : {}) });
      const r = await http(`https://api.fireworks.ai/v1/accounts/fireworks/models?${q}`, { headers }, 20_000);
      rejectStatus(r.status);
      const b = json(r.text);
      entries.push(...parseModels(provider, b));
      token = typeof b.nextPageToken === "string" ? b.nextPageToken : "";
      if (!token) break;
    }
  } else {
    const base = await baseFor(provider, endpoint);
    const r = await http(`${base}/models${provider === "anthropic" ? "?limit=1000" : ""}`, { headers }, 20_000);
    rejectStatus(r.status);
    entries = parseModels(provider, json(r.text));
  }
  const unique = new Map(entries.filter((e) => e.id && e.id !== "undefined").map((e) => [e.id, e]));
  return [...unique.values()].sort((a, b) => a.id.localeCompare(b.id));
}

// ─── Chat ───────────────────────────────────────────────────────────────────

export type ChatConfig = { provider: ProviderId; model: string; key: string; endpoint: string };

/** Pure: pull the JSON object out of a reply that may carry reasoning or a code fence. Exported for tests. */
export function extractJson(text: string): string {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{"), end = t.lastIndexOf("}");
  return start >= 0 && end > start ? t.slice(start, end + 1) : t;
}

/** Parameters a model may refuse; dropped and retried once if the provider names them in a 400. */
const OPTIONAL = ["temperature", "response_format"] as const;

/**
 * One system + user exchange that should come back as a JSON object. Returns the JSON
 * text; the caller parses and validates it. Never retries on a rejected key.
 */
export async function chatJson(c: ChatConfig, system: string, user: string, maxTokens = 700, timeoutMs = 25_000): Promise<string> {
  const spec = PROVIDERS[c.provider];
  // A Mistral endpoint comes only from MISTRAL_BASE_URL (a test override); the admin pane never stores one.
  const base = c.provider === "mistral" && c.endpoint ? c.endpoint.replace(/\/+$/, "") : await baseFor(c.provider, c.endpoint);
  const headers = { "Content-Type": "application/json", Accept: "application/json", ...authHeaders(c.provider, c.key) };

  let url: string;
  let payload: Record<string, unknown>;
  if (c.provider === "anthropic") {
    url = `${base}/messages`;
    payload = { model: c.model, max_tokens: maxTokens, temperature: 0, system: `${system}\nRespond with the JSON object only.`, messages: [{ role: "user", content: user }] };
  } else {
    url = `${base}/chat/completions`;
    payload = {
      model: c.model,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };
    // OpenAI's current models take max_completion_tokens and spend part of it on reasoning.
    if (c.provider === "openai") payload.max_completion_tokens = Math.max(maxTokens, 4000);
    else payload.max_tokens = maxTokens;
    if (spec.jsonMode) payload.response_format = { type: "json_object" };
    if (c.provider === "openrouter") payload.provider = { data_collection: "deny" };
  }

  let r = await http(url, { method: "POST", headers, body: JSON.stringify(payload) }, timeoutMs);
  if (r.status === 400) {
    const named = OPTIONAL.filter((k) => k in payload && r.text.includes(k));
    if (named.length) {
      for (const k of named) delete payload[k];
      r = await http(url, { method: "POST", headers, body: JSON.stringify(payload) }, timeoutMs);
    }
  }
  rejectStatus(r.status);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(r.text);
  } catch {
    throw new ProviderError("The provider returned something that is not JSON.");
  }
  const text =
    c.provider === "anthropic"
      ? ((body.content as { type?: string; text?: string }[] | undefined) ?? []).filter((b) => b?.type === "text").map((b) => b.text ?? "").join("")
      : (body.choices as { message?: { content?: unknown } }[] | undefined)?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new ProviderError("The model returned no content.");
  return extractJson(text);
}
