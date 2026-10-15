"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function Shell({ title, lede, children }: { title: string; lede: string; children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <aside className="auth-brandside">
        <Link href="/" className="brand"><span className="brand-dot" />learnai<em className="brand-beta">beta</em></Link>
        <div>
          <h2 className="serif">Locked out? <em>It happens.</em></h2>
          <p>We will email you a one-time link. It works for one hour, and only once.</p>
        </div>
        <span style={{ color: "var(--fg-mute)", fontSize: 13 }}>Two days learning. Thirty days practice.</span>
      </aside>
      <main className="auth-formside">
        <div className="auth-card">
          <h1 className="serif">{title}</h1>
          <p className="lede">{lede}</p>
          {children}
        </div>
      </main>
    </div>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) setMsg(d.message);
    else setErr(d.error || "Something went wrong.");
  }

  return (
    <Shell title="Forgot your password?" lede="Enter the email you signed up with.">
      {msg ? (
        <div className="set-ok" style={{ marginTop: 18 }}>{msg}</div>
      ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="fp-email">Email</label>
            <input id="fp-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@org.com" />
          </div>
          {err && <div className="formerr">{err}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "One moment…" : "Send me a link"}</button>
        </form>
      )}
      <p className="formnote"><Link href="/login">← Back to sign in</Link></p>
    </Shell>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [valid, setValid] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/reset?token=${encodeURIComponent(token)}`).then((r) => r.json()).then((d) => setValid(!!d.valid)).catch(() => setValid(false));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw !== pw2) return setErr("The two passwords do not match.");
    setBusy(true);
    const res = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: pw }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(d.message || "Something went wrong.");
    setDone(true);
    setTimeout(() => router.push("/login"), 1800);
  }

  return (
    <Shell title="Choose a new password" lede="At least 8 characters. You will be signed out everywhere else.">
      {valid === null && <p className="qa-meta" style={{ marginTop: 16 }}>Checking your link…</p>}
      {valid === false && (
        <>
          <div className="formerr">This reset link is invalid or has expired.</div>
          <p className="formnote"><Link href="/forgot-password">Ask for a new link</Link></p>
        </>
      )}
      {valid && !done && (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="np1">New password</label>
            <input id="np1" className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>
          <div className="field">
            <label htmlFor="np2">Repeat it</label>
            <input id="np2" className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>
          {err && <div className="formerr">{err}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "One moment…" : "Set new password"}</button>
        </form>
      )}
      {done && <div className="set-ok" style={{ marginTop: 18 }}>Password changed. Taking you to sign in…</div>}
    </Shell>
  );
}
