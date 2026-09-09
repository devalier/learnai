"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { name, email, password } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Something went wrong.");
        setBusy(false);
        return;
      }
      router.push(data.role === "ADMIN" ? "/admin" : "/");
      router.refresh();
    } catch {
      setErr("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <aside className="auth-brandside">
        <Link href="/" className="brand"><span className="brand-dot" />learnai<b>.</b>devalier</Link>
        <div>
          <h2 className="serif">
            The List is free. <em>Progress</em> is yours to keep.
          </h2>
          <p>
            Create an account to tick items off, resume where you left off, and carry the 30-day
            practice plan across devices. No account needed to read the programme.
          </p>
        </div>
        <span style={{ color: "var(--fg-mute)", fontSize: 13 }}>Two days learning. Thirty days practice.</span>
      </aside>

      <main className="auth-formside">
        <div className="auth-card">
          <h1 className="serif">{isRegister ? "Create your account" : "Welcome back"}</h1>
          <p className="lede">
            {isRegister ? "Track your progress through the AI curriculum." : "Sign in to pick up where you left off."}
          </p>

          <form onSubmit={submit}>
            {isRegister && (
              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="Jane Doe" />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@org.com" />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={isRegister ? "new-password" : "current-password"} placeholder={isRegister ? "At least 8 characters" : "••••••••"} />
            </div>

            {err && <div className="formerr">{err}</div>}

            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "One moment…" : isRegister ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="formnote">
            {isRegister ? (
              <>Already have an account? <Link href="/login">Sign in</Link></>
            ) : (
              <>New here? <Link href="/register">Create an account</Link></>
            )}
          </p>
          <p className="formnote" style={{ marginTop: 8 }}>
            <Link href="/" style={{ color: "var(--fg-mute)" }}>← Continue without an account</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
