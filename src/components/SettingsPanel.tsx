"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SettingsPanel({
  name,
  email,
  socialOn,
}: {
  name: string;
  email: string;
  socialOn: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(socialOn);
  const [age, setAge] = useState(false);
  const [pol, setPol] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState("");
  const [delWord, setDelWord] = useState("");
  const [delErr, setDelErr] = useState<string | null>(null);

  async function setSocial(enabled: boolean) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/me/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, confirmAge: age, confirmPolicies: pol }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: data.error || "Something went wrong." });
      return;
    }
    setOn(enabled);
    setConfirmOff(false);
    setAge(false);
    setPol(false);
    setMsg({
      ok: true,
      text: enabled ? "Social features are on." : "Social features are off and your social data has been deleted.",
    });
    router.refresh();
  }

  async function deleteAccount() {
    setBusy(true);
    setDelErr(null);
    const res = await fetch("/api/me", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: delWord, password: delPw }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDelErr(data.error || "Something went wrong.");
      setBusy(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="settings">
      <div className="kick" style={{ marginBottom: 6 }}>Settings</div>
      <h1 className="serif" style={{ fontSize: 30, letterSpacing: "-0.02em" }}>Your account</h1>
      <p className="set-sub">{name} · {email}</p>

      <section className="set-card">
        <h2>Social features</h2>
        <p>
          Quizzes, questions and answers, votes, and appearing to others on a topic. They are <b>off by default</b>.
          {on
            ? " They are on for you now."
            : " Turn them on only if you want to take part."}
        </p>
        {!on ? (
          <>
            <label className="set-check">
              <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} />
              <span>I am 16 or older.</span>
            </label>
            <label className="set-check">
              <input type="checkbox" checked={pol} onChange={(e) => setPol(e.target.checked)} />
              <span>
                I have read the <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms</Link>, and I
                agree that my contributions can be seen by other people who have turned social features on. I can turn
                this off at any time.
              </span>
            </label>
            <button className="btn btn-primary btn-sm" disabled={busy || !age || !pol} onClick={() => setSocial(true)}>
              Turn on social features
            </button>
          </>
        ) : !confirmOff ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmOff(true)}>Turn off social features…</button>
        ) : (
          <div className="set-warn">
            <b>This deletes your social data.</b> Your quiz answers, questions, answers, votes, claims and positions are
            erased, not hidden. Your progress on The List is kept. This cannot be undone.
            <div className="set-row">
              <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => setSocial(false)}>
                Turn off and delete my social data
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmOff(false)}>Cancel</button>
            </div>
          </div>
        )}
        {msg && <div className={msg.ok ? "set-ok" : "formerr"}>{msg.text}</div>}
      </section>

      <section className="set-card">
        <h2>Your data</h2>
        <p>Download a copy of everything we hold about you, as a JSON file.</p>
        <a className="btn btn-ghost btn-sm" href="/api/me/export" download>Download my data</a>
      </section>

      <section className="set-card set-danger">
        <h2>Delete my profile and all my data</h2>
        <p>
          This permanently deletes your account, your progress and everything social. <b>It cannot be reversed.</b> We
          cannot restore it afterwards, not even if you ask.
        </p>
        {!delOpen ? (
          <button className="btn btn-danger btn-sm" onClick={() => setDelOpen(true)}>Delete my profile and all my data…</button>
        ) : (
          <div>
            <div className="field">
              <label htmlFor="delpw">Your password</label>
              <input id="delpw" className="input" type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="field">
              <label htmlFor="delword">Type DELETE to confirm</label>
              <input id="delword" className="input" value={delWord} onChange={(e) => setDelWord(e.target.value)} autoComplete="off" />
            </div>
            {delErr && <div className="formerr">{delErr}</div>}
            <div className="set-row">
              <button className="btn btn-danger btn-sm" disabled={busy || delWord !== "DELETE" || !delPw} onClick={deleteAccount}>
                Permanently delete everything
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setDelOpen(false); setDelPw(""); setDelWord(""); setDelErr(null); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="set-foot">
        <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms</Link> · <Link href="/cookies">Cookies</Link>
      </p>
    </div>
  );
}
