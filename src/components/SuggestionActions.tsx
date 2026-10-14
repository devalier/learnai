"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SuggestionActions({ id, status, hasDraft }: { id: string; status: string; hasDraft: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(action: "approve" | "reject" | "retire") {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/admin/expansions/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setErr(d.message || d.error || "Something went wrong.");
    setBusy(false);
    router.refresh();
  }

  if (status === "REJECTED") return null;
  return (
    <div className="set-row">
      {status === "PENDING" && (
        <>
          <button className="btn btn-primary btn-sm" disabled={busy || !hasDraft} onClick={() => act("approve")}>Approve and publish</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act("reject")}>Reject</button>
        </>
      )}
      {status === "PUBLISHED" && (
        <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => act("retire")}>Retire this node</button>
      )}
      {err && <span className="formerr" style={{ margin: 0 }}>{err}</span>}
    </div>
  );
}
