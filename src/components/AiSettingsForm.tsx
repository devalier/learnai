"use client";

import { useMemo, useState } from "react";
import type { AiStatus } from "@/lib/aisettings";

export type ProviderOption = { id: string; label: string; requiresKey: boolean; publicCatalog: boolean; needsEndpoint: boolean; example: string; inEU: boolean };
type Model = { id: string; label: string };

async function call(method: "POST" | "DELETE", body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch("/api/admin/ai", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {}
  return { ok: res.ok, data };
}

/**
 * Enter a key, pull the models it can use, pick one, save. Saving runs a test call
 * first, so a wrong key or a model that cannot answer in JSON is refused before it
 * reaches users. The key field is never pre-filled: a stored key is shown only as its
 * last four characters, and leaving the field blank keeps it.
 */
export default function AiSettingsForm({ initial, providers }: { initial: AiStatus; providers: ProviderOption[] }) {
  const [status, setStatus] = useState<AiStatus>(initial);
  const [provider, setProvider] = useState<string>(initial.provider ?? "mistral");
  const [key, setKey] = useState("");
  const [endpoint, setEndpoint] = useState(initial.source === "admin" ? initial.endpoint : "");
  const [models, setModels] = useState<Model[]>([]);
  const [filter, setFilter] = useState("");
  const [model, setModel] = useState(initial.model);
  const [busy, setBusy] = useState<"" | "models" | "save" | "clear">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const spec = providers.find((p) => p.id === provider)!;
  const hasStoredKey = status.source === "admin" && status.provider === provider && !!status.keyHint && !status.problem;
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? models.filter((m) => m.id.toLowerCase().includes(f) || m.label.toLowerCase().includes(f)) : models;
  }, [models, filter]);

  function pickProvider(id: string) {
    setProvider(id);
    setModels([]);
    setModel(status.provider === id ? status.model : "");
    setError("");
    setNotice("");
  }

  async function pull() {
    setBusy("models");
    setError("");
    setNotice("");
    const { ok, data } = await call("POST", { action: "models", provider, key, endpoint });
    setBusy("");
    if (!ok) return setError(String(data.message ?? "Could not list models."));
    const list = (data.models as Model[]) ?? [];
    setModels(list);
    if (!list.length) setNotice("The provider returned no models. You can still type a model id.");
    else if (!list.some((m) => m.id === model)) setModel(list[0].id);
  }

  async function save() {
    setBusy("save");
    setError("");
    setNotice("");
    const { ok, data } = await call("POST", { action: "save", provider, key, endpoint, model });
    setBusy("");
    if (!ok) return setError(String(data.message ?? "Could not save."));
    setStatus(data.status as AiStatus);
    setKey("");
    setNotice("Tested and saved. The AI features now use this model.");
  }

  async function clear() {
    if (!confirm("Remove the AI setting? The site falls back to MISTRAL_API_KEY in the server environment, or the AI features turn off.")) return;
    setBusy("clear");
    setError("");
    const { ok, data } = await call("DELETE");
    setBusy("");
    if (!ok) return setError("Could not remove it.");
    setStatus(data.status as AiStatus);
    setNotice("Removed.");
  }

  const current =
    status.source === "admin"
      ? `${providers.find((p) => p.id === status.provider)?.label ?? status.provider} · ${status.model} · key ${status.keyHint || "none"}`
      : status.source === "environment"
        ? `Mistral AI from the server environment · ${status.model} · key ${status.keyHint}`
        : "None. The AI features are off.";

  return (
    <>
      <div className="set-card">
        <h2>In use now</h2>
        <p>{current}</p>
        {status.problem && <div className="set-warn">{status.problem}</div>}
      </div>

      <div className="set-card">
        <h2>Choose the AI</h2>

        <div className="field">
          <label htmlFor="ai-provider">Provider</label>
          <select id="ai-provider" className="input" value={provider} onChange={(e) => pickProvider(e.target.value)}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.inEU ? "" : " (outside the EU)"}
              </option>
            ))}
          </select>
        </div>

        {!spec.inEU && (
          <div className="set-warn" style={{ marginTop: 14 }}>
            This provider is outside the EU. Users&rsquo; questions and answers will be sent there, and the privacy notice will say so.
            Before switching, make sure you have a data processing agreement with the provider and a lawful basis for the transfer
            (for example the EU&ndash;US Data Privacy Framework, or standard contractual clauses).
          </div>
        )}

        {spec.needsEndpoint && (
          <div className="field">
            <label htmlFor="ai-endpoint">Endpoint URL</label>
            <input id="ai-endpoint" className="input" placeholder="https://models.example.internal/v1" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
            <span className="set-sub">
              Any server with an OpenAI-style /v1/chat/completions API. Private network addresses are allowed; this server&rsquo;s own
              loopback address is not. Plain http only on a private network. Users&rsquo; text goes to this server, so check where it runs.
            </span>
          </div>
        )}

        <div className="field">
          <label htmlFor="ai-key">API key{spec.requiresKey ? "" : " (if your server needs one)"}</label>
          <input
            id="ai-key"
            className="input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={hasStoredKey ? `Stored: ${status.keyHint}. Leave blank to keep it.` : "Paste the key"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </div>

        <div className="set-row">
          <button className="btn btn-ghost btn-sm" onClick={pull} disabled={!!busy || (spec.requiresKey && !spec.publicCatalog && !key && !hasStoredKey)}>
            {busy === "models" ? "Asking the provider…" : "Pull available models"}
          </button>
        </div>

        <div className="field">
          <label htmlFor="ai-model">Model</label>
          {models.length > 0 && (
            <input className="input" placeholder={`Filter ${models.length} models`} value={filter} onChange={(e) => setFilter(e.target.value)} />
          )}
          {models.length > 0 ? (
            <select id="ai-model" className="input" size={Math.min(10, Math.max(3, shown.length))} value={model} onChange={(e) => setModel(e.target.value)}>
              {shown.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label ? `${m.id} — ${m.label}` : m.id}
                </option>
              ))}
            </select>
          ) : (
            <input id="ai-model" className="input" placeholder={`e.g. ${spec.example}`} value={model} onChange={(e) => setModel(e.target.value)} />
          )}
          <span className="set-sub">The site needs a chat model that can answer in JSON. Saving sends one short test request.</span>
        </div>

        {error && <div className="formerr" style={{ marginTop: 14 }}>{error}</div>}
        {notice && <div className="set-ok">{notice}</div>}

        <div className="set-row">
          <button className="btn btn-primary btn-sm" onClick={save} disabled={!!busy || !model.trim()}>
            {busy === "save" ? "Testing…" : "Test and save"}
          </button>
          {status.source === "admin" && (
            <button className="btn btn-danger btn-sm" onClick={clear} disabled={!!busy}>
              Remove setting
            </button>
          )}
        </div>
      </div>
    </>
  );
}
