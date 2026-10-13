"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "learnai_notice_v1";

/**
 * One-time notice. It is not a consent banner: the only cookie is the login
 * cookie, which is strictly necessary. Dismissal is remembered in localStorage
 * (never sent to the server), so it shows once.
 */
export default function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;
  return (
    <div className="cookie-notice" role="region" aria-label="Cookie notice">
      <p>
        One small cookie keeps you signed in. That&rsquo;s all it does: no tracking, no ads, nothing sold.{" "}
        <Link href="/cookies">Details</Link>
      </p>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => {
          try { localStorage.setItem(KEY, "1"); } catch {}
          setShow(false);
        }}
      >
        Got it
      </button>
    </div>
  );
}
