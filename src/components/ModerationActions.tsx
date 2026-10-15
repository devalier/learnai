"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ModerationActions({ kind, id, hidden, hasReports }: { kind: string; id: string; hidden: boolean; hasReports: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function act(action: "hide" | "restore" | "dismiss") {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, action }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setErr(d.message || d.error || "Something went wrong.");
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="set-row">
      {!hidden && <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => act("hide")}>Hide</button>}
      {hidden && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act("restore")}>Restore</button>}
      {hasReports && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act("dismiss")}>Dismiss reports{hidden ? " and restore" : ""}</button>}
      {err && <span className="formerr" style={{ margin: 0 }}>{err}</span>}
    </div>
  );
}
