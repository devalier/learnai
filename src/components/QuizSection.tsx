"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuizSummary, QuizView } from "@/lib/quiz";

type R = { ok: boolean; data: Record<string, unknown> & { message?: string; error?: string } };
async function post(url: string, body: unknown): Promise<R> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}
const errText = (r: R) => r.data.message || r.data.error || "Something went wrong.";
const LETTERS = ["A", "B", "C", "D"];

/** Quizzes on a node. Only mounted for opted-in users. */
export default function QuizSection({ slug, onChanged }: { slug: string; onChanged: () => void }) {
  const [list, setList] = useState<QuizSummary[] | null>(null);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/nodes/${slug}/quizzes`);
    if (res.ok) setList((await res.json()).quizzes);
  }, [slug]);
  useEffect(() => { setList(null); setOpen(null); load(); }, [load]);

  async function create() {
    setBusy(true);
    setErr(null);
    const r = await post(`/api/nodes/${slug}/quizzes`, { focus });
    if (!r.ok) setErr(errText(r));
    else { setFocus(""); setOpen(r.data.id as string); }
    await load();
    setBusy(false);
  }

  async function rate(q: QuizSummary, value: 1 | -1) {
    const r = await post(`/api/quizzes/${q.id}/rate`, { value: q.myRating === value ? 0 : value });
    if (!r.ok) setErr(errText(r));
    await load();
  }

  return (
    <>
      <div className="sec-head" style={{ margin: "22px 0 10px" }}>
        <span className="kick">Quizzes</span>
        <div className="sec-line" />
      </div>
      <p className="phelp" style={{ marginTop: 0 }}>
        Three quick AI-written questions. Pass (2 of 3) and you hold this node. Fail and a node you hold goes thin.
        You can rate a quiz after you pass it.
      </p>

      <div className="field" style={{ marginTop: 6 }}>
        <input className="input" placeholder="Optional focus, e.g. “data privacy”" value={focus} maxLength={100} onChange={(e) => setFocus(e.target.value)} />
        <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={busy} onClick={create}>
          {busy ? "Writing a quiz…" : "Create a quiz with AI"}
        </button>
        <span className="qa-tag" style={{ marginTop: 6 }}>Questions are AI-generated and can be wrong. You can challenge any answer key.</span>
      </div>
      {err && <div className="formerr">{err}</div>}

      {!list && <p style={{ color: "var(--fg-mute)", fontSize: 13.5 }}>Loading…</p>}
      {list && list.length === 0 && <p style={{ color: "var(--fg-mute)", fontSize: 13.5, marginTop: 12 }}>No quizzes yet. Create the first.</p>}
      {list?.map((q) => (
        <div key={q.id} className="qa-q">
          <div className="qa-row">
            <div className="qa-votes">
              <button className={q.myRating === 1 ? "on" : ""} disabled={!q.canRate} title={q.canRate ? undefined : "Pass this quiz to rate it"} onClick={() => rate(q, 1)} aria-label="Thumbs up">▲</button>
              <b>{q.score}</b>
              <button className={q.myRating === -1 ? "on" : ""} disabled={!q.canRate} title={q.canRate ? undefined : "Pass this quiz to rate it"} onClick={() => rate(q, -1)} aria-label="Thumbs down">▼</button>
            </div>
            <div className="qa-body">
              <div className="qa-text">{q.focus ? `Quiz: ${q.focus}` : "Quiz on this node"} <span className="qa-tag">AI-generated</span></div>
              <div className="qa-meta">
                {q.author}{q.mine && " (you)"} · {q.passers} passed
                {q.myAttempt && (
                  <span className={`qa-verdict ${q.myAttempt.passed ? "v-correct" : "v-incorrect"}`}>
                    {q.myAttempt.passed ? "Passed" : "Not passed"} {q.myAttempt.correct}/{q.myAttempt.total}
                  </span>
                )}
              </div>
              <button className="qa-link" onClick={() => setOpen(open === q.id ? null : q.id)}>
                {open === q.id ? "Close" : q.myAttempt ? "See results" : q.mine ? "View your quiz" : "Take this quiz"}
              </button>
            </div>
          </div>
          {open === q.id && <QuizPlayer id={q.id} onDone={() => { load(); onChanged(); }} />}
        </div>
      ))}
    </>
  );
}

function QuizPlayer({ id, onDone }: { id: string; onDone: () => void }) {
  const [quiz, setQuiz] = useState<QuizView | null>(null);
  const [picks, setPicks] = useState<(number | undefined)[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/quizzes/${id}`);
    if (res.ok) setQuiz(await res.json());
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!quiz) return <p className="qa-meta" style={{ marginTop: 10 }}>Loading…</p>;
  const canTake = !quiz.reveal;

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await post(`/api/quizzes/${id}/attempt`, { answers: quiz!.questions.map((_, i) => picks[i]) });
    setBusy(false);
    if (!r.ok) return setErr(errText(r));
    await load();
    onDone();
  }

  return (
    <div className="quiz-play">
      {quiz.myAttempt && (
        <div className={quiz.myAttempt.passed ? "set-ok" : "formerr"} style={{ marginTop: 0 }}>
          {quiz.myAttempt.passed
            ? `You passed with ${quiz.myAttempt.correct}/${quiz.myAttempt.total}. You hold this node.`
            : `You got ${quiz.myAttempt.correct}/${quiz.myAttempt.total}. If you held this node, it is now thin.`}
        </div>
      )}
      {quiz.questions.map((q, qi) => (
        <div key={q.id} className="quiz-q">
          <div className="qa-text"><b>{qi + 1}.</b> {q.text} {q.voided && <span className="qa-tag">(removed from scoring)</span>}</div>
          <div className="quiz-opts">
            {q.options.map((o, oi) => {
              const isKey = quiz.reveal && q.correctIndex === oi;
              const mine = q.myAnswer === oi;
              return (
                <label key={oi} className={`quiz-opt${isKey ? " key" : ""}${mine && !isKey ? " wrong" : ""}`}>
                  <input type="radio" name={`q-${q.id}`} disabled={!canTake} checked={canTake ? picks[qi] === oi : mine}
                    onChange={() => setPicks((p) => { const n = [...p]; n[qi] = oi; return n; })} />
                  <span><b>{LETTERS[oi]}.</b> {o}</span>
                </label>
              );
            })}
          </div>
          {quiz.reveal && q.explanation && <div className="qa-reason">{q.explanation} <span className="qa-tag">AI-generated</span></div>}
          {quiz.reveal && !q.reviewed && (
            <button className="qa-link" onClick={() => setChallenge(q.id)}>Challenge this answer key</button>
          )}
          {quiz.reveal && q.reviewed && <span className="qa-tag">Answer key re-checked by the AI.</span>}
        </div>
      ))}
      {err && <div className="formerr">{err}</div>}
      {note && <div className="set-ok">{note}</div>}
      {canTake && (
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={busy || quiz.questions.some((_, i) => picks[i] === undefined)} onClick={submit}>
          {busy ? "Checking…" : "Submit answers"}
        </button>
      )}
      {challenge && <KeyChallenge questionId={challenge} onClose={() => setChallenge(null)} onResult={(t) => { setNote(t); load(); }} />}
    </div>
  );
}

function KeyChallenge({ questionId, onClose, onResult }: { questionId: string; onClose: () => void; onResult: (text: string) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    const r = await post(`/api/quiz-questions/${questionId}/review`, { explanation: text });
    setBusy(false);
    if (!r.ok) return setErr(errText(r));
    const o = r.data.outcome;
    onResult(
      o === "UPHELD" ? "The AI re-checked it and kept the answer key."
        : o === "KEY_FIXED" ? "The AI found the key was wrong and corrected it. Past results are not re-graded."
          : "The AI found the question ambiguous and removed it from scoring."
    );
    onClose();
  }

  return (
    <div className="qa-modal-scrim" onClick={onClose}>
      <div className="qa-modal" role="dialog" aria-modal="true" aria-label="Challenge an answer key" onClick={(e) => e.stopPropagation()}>
        <h4>Challenge this answer key</h4>
        <label htmlFor="qk-expl" className="qa-lbl">What is wrong with it?</label>
        <textarea id="qk-expl" className="input qa-input" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Explain what the quiz got wrong…" />
        <p className="phelp">The AI re-checks once, with your explanation, and that result is final.</p>
        {err && <div className="formerr">{err}</div>}
        <div className="set-row">
          <button className="btn btn-primary btn-sm" disabled={busy || text.trim().length < 10} onClick={go}>{busy ? "Asking the AI…" : "Submit challenge"}</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
