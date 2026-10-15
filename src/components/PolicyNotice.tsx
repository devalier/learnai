"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/**
 * Shown to a signed-in user whose last-agreed version of the Privacy Policy and
 * Terms is not the current one. Social features stay paused until they confirm.
 */
export default function PolicyNotice() {
  const router = useRouter();
  const pathname = usePathname(); // the layout persists across navigation, so check again on each page
  const [state, setState] = useState<{ needsAck: boolean; socialOn: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/me/policy")
      .then((r) => r.json())
      .then((d) => setState(d.signedIn ? { needsAck: d.needsAck, socialOn: d.socialOn } : null))
      .catch(() => {});
  }, [pathname]);

  if (!state?.needsAck) return null;
  return (
    <div className="policy-notice" role="region" aria-label="Policy update">
      <p>
        <b>We have updated our <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms</Link>.</b>{" "}
        {state.socialOn ? "Social features are paused until you confirm you have seen the changes." : "Please confirm you have seen the changes."}
      </p>
      <button
        className="btn btn-primary btn-sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await fetch("/api/me/policy", { method: "POST" });
          setState({ needsAck: false, socialOn: state.socialOn });
          setBusy(false);
          router.refresh();
        }}
      >
        I have read the update
      </button>
    </div>
  );
}
