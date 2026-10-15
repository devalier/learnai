"use client";

import { useState } from "react";

const REASONS = [
  ["ABUSE", "Abusive or hateful"],
  ["SPAM", "Spam or advertising"],
  ["OFF_TOPIC", "Off topic"],
  ["PERSONAL_DATA", "Shares personal data"],
  ["OTHER", "Something else"],
] as const;

export type ReportTarget = { kind: "question" | "answer" | "quiz"; id: string };

/** A small popup to report a post. Three different people reporting it hides it until an admin looks. */
export default function ReportDialog({ target, onClose, onDone }: { target: ReportTarget; onClose: () => void; onDone?: () => void }) {
  const [reason, setReason] = useState<string>("ABUSE");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function go() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...target, reason, note }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(d.message || d.error || "Something went wrong.");
    setDone(true);
    onDone?.();
  }

  return (
    <div className="qa-modal-scrim" onClick={onClose}>
      <div className="qa-modal" role="dialog" aria-modal="true" aria-label="Report a post" onClick={(e) => e.stopPropagation()}>
        <h4>Report this {target.kind}</h4>
        {done ? (
          <>
            <p>Thank you. An admin will look at it. If several people report the same post it is hidden until then.</p>
            <button className="btn btn-primary btn-sm" onClick={onClose}>Close</button>
          </>
        ) : (
          <>
            <label htmlFor="rp-reason" className="qa-lbl">What is wrong with it?</label>
            <select id="rp-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label htmlFor="rp-note" className="qa-lbl" style={{ marginTop: 12 }}>Anything else? {reason === "OTHER" ? "(required)" : "(optional)"}</label>
            <textarea id="rp-note" className="input qa-input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
            {err && <div className="formerr">{err}</div>}
            <div className="set-row">
              <button className="btn btn-primary btn-sm" disabled={busy || (reason === "OTHER" && note.trim().length < 5)} onClick={go}>{busy ? "Sending…" : "Send report"}</button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
