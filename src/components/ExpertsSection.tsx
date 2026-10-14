"use client";

import { useCallback, useEffect, useState } from "react";
import type { Experts } from "@/lib/stake";

/** Experts on a node, and the stake facility. Only mounted for opted-in users. */
export default function ExpertsSection({ slug, onChanged }: { slug: string; onChanged: () => void }) {
  const [data, setData] = useState<Experts | null>(null);
  const [ok, setOk] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/nodes/${slug}/experts`);
    if (res.ok) setData(await res.json());
  }, [slug]);
  useEffect(() => { setData(null); setConfirm(false); setOk(false); load(); }, [load]);

  async function act(method: "POST" | "DELETE") {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/nodes/${slug}/stake`, { method });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setErr(d.message || d.error || "Something went wrong.");
    else { setConfirm(false); setOk(false); }
    await load();
    onChanged();
    setBusy(false);
  }

  return (
    <>
      <div className="sec-head" style={{ margin: "22px 0 10px" }}>
        <span className="kick">Experts</span>
        <div className="sec-line" />
      </div>
      <p className="phelp" style={{ marginTop: 0 }}>
        People who have staked this node: a claim of expertise, earned by answering well and acing quizzes. A staked
        node never thins. Top 10 shown.
      </p>

      {!data && <p style={{ color: "var(--fg-mute)", fontSize: 13.5 }}>Loading…</p>}
      {data && data.experts.length === 0 && <p style={{ color: "var(--fg-mute)", fontSize: 13.5 }}>No experts yet.</p>}
      {data && data.experts.length > 0 && (
        <ol className="exp-list">
          {data.experts.map((e) => (
            <li key={e.rank} className={e.mine ? "me" : ""}>
              <span className="exp-rank">{e.rank}</span>
              <span>{e.name}{e.mine && " (you)"}</span>
            </li>
          ))}
        </ol>
      )}

      {data && (
        <div className="exp-me">
          {data.me.staked ? (
            <>
              <div className="set-ok" style={{ marginTop: 0 }}>You have staked this node. It will not thin.</div>
              <button className="qa-link" disabled={busy} onClick={() => act("DELETE")}>Remove my stake</button>
            </>
          ) : data.me.eligible ? (
            confirm ? (
              <div className="set-warn">
                <label className="set-check" style={{ marginBottom: 0 }}>
                  <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
                  <span>I claim expertise on this node. I may appear on its experts list under my first name, and I can remove my stake at any time.</span>
                </label>
                <div className="set-row">
                  <button className="btn btn-primary btn-sm" disabled={busy || !ok} onClick={() => act("POST")}>Stake this node</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => setConfirm(true)}>Stake this node</button>
            )
          ) : (
            <p className="phelp" style={{ margin: 0 }}>
              {data.me.holds
                ? `To stake this node you need ${data.me.needed} successes on it: correct answers, quizzes passed with no mistakes, or quizzes you wrote that others passed. You have ${Math.min(data.me.successes, data.me.needed)} of ${data.me.needed}.`
                : "You can stake a node you hold. Pass a quiz with no mistakes or answer a question correctly to hold it first."}
            </p>
          )}
          {err && <div className="formerr">{err}</div>}
        </div>
      )}
    </>
  );
}
