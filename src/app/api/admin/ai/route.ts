import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readBody } from "@/lib/body";
import { hit } from "@/lib/ratelimit";
import { PROVIDERS, ProviderError, chatJson, checkEndpoint, isProviderId, listModels, type ProviderId } from "@/lib/aiproviders";
import { aiStatus, clearAiSetting, saveAiSetting, storedKeyFor } from "@/lib/aisettings";

export const dynamic = "force-dynamic";

/**
 * The AI provider setting. Admin only.
 *
 *   GET                                         current status (never the key)
 *   POST { action: "models", provider, key?, endpoint? }   models that key can use
 *   POST { action: "save", provider, model, key?, endpoint? }   test, then store
 *   DELETE                                      remove; fall back to the environment
 *
 * A blank key means "the key already stored for this provider". The key is encrypted
 * before it is written and is never sent back to the browser.
 */

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const fail = (status: number, message: string) => NextResponse.json({ error: "AI_SETTING", message }, { status });

async function admin() {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return NextResponse.json({ status: await aiStatus() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const s = await admin();
  if (!s) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (await hit(`admin-ai:${s.sub}`, { max: 40, windowMs: 10 * 60_000 })) return fail(429, "Too many attempts. Wait a few minutes.");
  const parsed = await readBody(req, 8 * 1024);
  if ("res" in parsed) return parsed.res;
  const b = parsed.body;

  if (!isProviderId(b.provider)) return fail(400, "Choose a provider from the list.");
  const provider: ProviderId = b.provider;
  const spec = PROVIDERS[provider];

  try {
    // Fixed-API providers never take an endpoint; a self-hosted one is vetted first.
    const endpoint = spec.base ? "" : await checkEndpoint(str(b.endpoint, 400));
    const key = str(b.key, 400) || (await storedKeyFor(provider, endpoint));

    if (b.action === "models") {
      return NextResponse.json({ models: await listModels(provider, key, endpoint) });
    }
    if (b.action === "save") {
      const model = str(b.model, 200);
      if (!model) return fail(400, "Choose or type a model.");
      if (spec.requiresKey && !key) return fail(400, "This provider needs an API key.");
      // Prove the combination works before anyone's quiz depends on it.
      const reply = await chatJson({ provider, model, key, endpoint }, 'Reply with exactly this JSON object: {"ok": true}', "Test.", 300, 30_000);
      let ok = false;
      try {
        ok = (JSON.parse(reply) as { ok?: unknown })?.ok === true;
      } catch {}
      if (!ok) return fail(400, "The model answered, but not with the JSON this site needs. Choose another model.");
      await saveAiSetting({ provider, model, endpoint, key }, s.sub);
      return NextResponse.json({ status: await aiStatus() });
    }
    return fail(400, "Unknown action.");
  } catch (e) {
    if (e instanceof ProviderError) return fail(400, e.message);
    throw e;
  }
}

export async function DELETE() {
  const s = await admin();
  if (!s) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  await clearAiSetting(s.sub);
  return NextResponse.json({ status: await aiStatus() });
}
