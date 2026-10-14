"use client";

import { useCallback, useEffect, useState } from "react";

type Mine = { id: string; nodeTitle: string; sourceUrl: string; status: "PUBLISHED" | "PENDING" | "REJECTED"; reason: string };

/**
 * Grow the map: suggest a new node and a free source. Shown only to people who
 * have staked this node (everyone else sees nothing).
 */
export default function ExpansionSection({ slug }: { slug: string }) {
  const [staked, setStaked] = useState<boolean | null>(null);
  const [mine, setMine] = useState<Mine[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [ex, ms] = await Promise.all([fetch(`/api/nodes/${slug}/experts`), fetch(`/api/nodes/${slug}/expansions`)]);
    if (ex.ok) setStaked((await ex.json()).me.staked);
    if (ms.ok) setMine((await ms.json()).suggestions);
  }, [slug]);
  useEffect(() => { setStaked(null); setMsg(null); load(); }, [load]);

  if (!staked) return null;

  async function submit() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/nodes/${slug}/expansions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nodeTitle: title, sourceUrl: url }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setMsg({ ok: false, text: d.message || d.error || "Something went wrong." });
    else {
      setMsg({
        ok: d.status !== "REJECTED",
        text: d.status === "PUBLISHED" ? "Published. Your node is now on the map." : d.status === "PENDING" ? d.reason : d.reason,
      });
      if (d.status !== "REJECTED") { setTitle(""); setUrl(""); }
    }
    await load();
  }

  return (
    <>
      <div className="sec-head" style={{ margin: "22px 0 10px" }}>
        <span className="kick">Grow the map</span>
        <div className="sec-line" />
      </div>
      <p className="phelp" style={{ marginTop: 0 }}>
        As an expert here you can suggest a new node next to this one, with a free source for it. The AI checks that the
        source is free to read, that the node is new, and that it really extends this one. 3 suggestions a day.
      </p>
      <div className="field" style={{ marginTop: 6 }}>
        <input className="input" placeholder="Node name, one to three words" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
        <input className="input" style={{ marginTop: 8 }} placeholder="https:// link to a free source" value={url} maxLength={500} onChange={(e) => setUrl(e.target.value)} />
        <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={busy || title.trim().length < 2 || !url.trim()} onClick={submit}>
          {busy ? "Checking the source…" : "Suggest this node"}
        </button>
      </div>
      {msg && <div className={msg.ok ? "set-ok" : "formerr"}>{msg.text}</div>}
      {mine.length > 0 && (
        <ul className="exp-list" style={{ marginTop: 12 }}>
          {mine.map((m) => (
            <li key={m.id} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
              <span><b>{m.nodeTitle}</b> <span className={`qa-verdict ${m.status === "PUBLISHED" ? "v-correct" : m.status === "REJECTED" ? "v-incorrect" : "v-unsure"}`}>{m.status.toLowerCase()}</span></span>
              {m.reason && <span className="qa-meta">{m.reason}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
