"use client";

import { useState } from "react";

/** Ask an admin to review something the AI marked wrong. Private: only the asker and the admins ever see it. */
export default function AppealDialog({
  title, quote, url, onClose, onDone,
}: {
  title: string;
  quote: string;
  url: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function go() {
    setBusy(true);
    setErr(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ explanation: text }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(d.message || d.error || "Something went wrong.");
    setSent(true);
    onDone();
  }

  return (
    <div className="qa-modal-scrim" onClick={onClose}>
      <div className="qa-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h4>{title}</h4>
        {sent ? (
          <>
            <p>Thank you. An admin will review it. Only you and the admins can see this.</p>
            <button className="btn btn-primary btn-sm" onClick={onClose}>Close</button>
          </>
        ) : (
          <>
            <p className="qa-quote">{quote}</p>
            <label htmlFor="ap-expl" className="qa-lbl">Why are you sure the AI is wrong?</label>
            <textarea id="ap-expl" className="input qa-input" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Explain what the AI got wrong…" />
            <p className="phelp">The AI has already re-checked this once. An admin will decide. Only you and the admins can see your appeal.</p>
            {err && <div className="formerr">{err}</div>}
            <div className="set-row">
              <button className="btn btn-primary btn-sm" disabled={busy || text.trim().length < 10} onClick={go}>{busy ? "Sending…" : "Ask an admin"}</button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
