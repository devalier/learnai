"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const LETTERS = ["A", "B", "C", "D"];

/** An admin's decision on one appeal. */
export default function AppealActions({ kind, id, options, currentKey }: { kind: "answer" | "quiz"; id: string; options?: string[]; currentKey?: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [pick, setPick] = useState<number | "">("");

  async function act(action: string, correctIndex?: number) {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/appeals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, action, correctIndex, note }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setErr(d.message || d.error || "Something went wrong.");
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <input className="input" style={{ marginBottom: 8 }} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Note for your records (optional)" aria-label="Note" />
      <div className="set-row">
        {kind === "answer" ? (
          <>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act("overturn")}>Mark the answer correct</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act("uphold")}>Keep the judgement</button>
          </>
        ) : (
          <>
            <select className="input" style={{ width: "auto" }} value={pick} onChange={(e) => setPick(e.target.value === "" ? "" : Number(e.target.value))} aria-label="Correct option">
              <option value="">Correct option…</option>
              {(options ?? []).map((_, i) => i !== currentKey && <option key={i} value={i}>{LETTERS[i]}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" disabled={busy || pick === ""} onClick={() => act("fix", pick as number)}>Change the key</button>
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => act("void")}>Remove from scoring</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act("uphold")}>Keep the key</button>
          </>
        )}
        {err && <span className="formerr" style={{ margin: 0 }}>{err}</span>}
      </div>
    </div>
  );
}
