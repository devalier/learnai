"use client";

import { useState } from "react";

/**
 * Thumbs up / down on a resource. Only people with a verified hold on a topic it
 * covers can rate (the server decides); everyone else sees nothing here.
 */
export default function RateThumbs({
  resourceId,
  canRate,
  myVote,
  onChange,
}: {
  resourceId: string;
  canRate: boolean;
  myVote: number;
  onChange?: (value: number) => void;
}) {
  const [vote, setVote] = useState(myVote);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!canRate && vote === 0) return null;

  async function cast(v: 1 | -1) {
    const next = vote === v ? 0 : v;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/resources/${resourceId}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: next }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(d.message || "Could not save your vote.");
    setVote(next);
    onChange?.(next);
  }

  return (
    <span className="rate">
      <span className="rate-lbl">Useful?</span>
      <button className={vote === 1 ? "on" : ""} disabled={busy || !canRate} onClick={() => cast(1)} aria-label="Thumbs up" aria-pressed={vote === 1} title={canRate ? "This helped" : undefined}>👍</button>
      <button className={vote === -1 ? "on" : ""} disabled={busy || !canRate} onClick={() => cast(-1)} aria-label="Thumbs down" aria-pressed={vote === -1} title={canRate ? "This did not help" : undefined}>👎</button>
      {err && <span className="rate-err">{err}</span>}
    </span>
  );
}
