"use client";

import { useCallback, useEffect, useState } from "react";
import type { QaAnswer, QaList, QaQuestion } from "@/lib/qa";
import ReportDialog, { type ReportTarget } from "./ReportDialog";
import AppealDialog from "./AppealDialog";

const VERDICT_LABEL = { CORRECT: "Correct", INCORRECT: "Incorrect", UNSURE: "Unsure" } as const;

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

/** Questions and answers on a node. Only mounted for opted-in users. */
export default function QaSection({ slug, onChanged }: { slug: string; onChanged: () => void }) {
  const [list, setList] = useState<QaList | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newQ, setNewQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<QaAnswer | null>(null);
  const [appealing, setAppealing] = useState<QaAnswer | null>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/nodes/${slug}/questions`);
    if (res.ok) setList(await res.json());
  }, [slug]);
  useEffect(() => { setList(null); load(); }, [load]);

  async function run(fn: () => Promise<{ ok: boolean; data: { message?: string; error?: string } }>) {
    setBusy(true);
    setErr(null);
    const r = await fn();
    if (!r.ok) setErr(r.data.message || r.data.error || "Something went wrong.");
    await load();
    setBusy(false);
    return r.ok;
  }

  const vote = (target: { questionId?: string; answerId?: string }, current: number, value: 1 | -1) =>
    run(() => post("/api/votes", { ...target, value: current === value ? 0 : value }));

  async function ask() {
    if (await run(() => post(`/api/nodes/${slug}/questions`, { text: newQ }))) setNewQ("");
  }

  return (
    <>
      <div className="sec-head" style={{ margin: "22px 0 10px" }}>
        <span className="kick">Questions &amp; answers</span>
        <div className="sec-line" />
      </div>
      <p className="phelp" style={{ marginTop: 0 }}>
        Ask, answer, and vote. A correct answer, judged by AI, means you hold this node. You can vote once you hold it.
      </p>

      <div className="field" style={{ marginTop: 6 }}>
        <textarea className="input qa-input" placeholder="Ask a question about this node…" value={newQ} onChange={(e) => setNewQ(e.target.value)} maxLength={500} />
        <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={busy || newQ.trim().length < 10} onClick={ask}>
          Ask
        </button>
      </div>
      {err && <div className="formerr">{err}</div>}

      {!list && <p style={{ color: "var(--fg-mute)", fontSize: 13.5 }}>Loading…</p>}
      {list && list.questions.length === 0 && <p style={{ color: "var(--fg-mute)", fontSize: 13.5, marginTop: 12 }}>No questions yet. Be the first.</p>}
      {list?.questions.map((q) => (
        <Question key={q.id} q={q} canVote={list.canVote} busy={busy}
          onVote={(target, cur, v) => vote(target, cur, v)}
          onAnswer={(text) => run(() => post(`/api/questions/${q.id}/answers`, { text })).then((ok) => { if (ok) onChanged(); return ok; })}
          onChallenge={(a) => setChallenge(a)} onAppeal={(a) => setAppealing(a)} onReport={(t) => setReport(t)} />
      ))}

      {report && <ReportDialog target={report} onClose={() => setReport(null)} />}
      {appealing && (
        <AppealDialog title="Ask an admin to review" quote={`“${appealing.text}” was judged ${appealing.verdict}: ${appealing.aiReason}`}
          url={`/api/answers/${appealing.id}/appeal`} onClose={() => setAppealing(null)} onDone={load} />
      )}
      {challenge && (
        <ChallengeDialog answer={challenge} onClose={() => setChallenge(null)}
          onSubmit={async (explanation) => {
            const r = await post(`/api/answers/${challenge.id}/review`, { explanation });
            if (r.ok) { await load(); onChanged(); }
            return r;
          }} />
      )}
    </>
  );
}

function Votes({ score, mine, canVote, onUp, onDown }: { score: number; mine: number; canVote: boolean; onUp: () => void; onDown: () => void }) {
  const title = canVote ? undefined : "You can vote once you hold this node";
  return (
    <div className="qa-votes">
      <button className={mine === 1 ? "on" : ""} disabled={!canVote} title={title} onClick={onUp} aria-label="Thumbs up">▲</button>
      <b>{score}</b>
      <button className={mine === -1 ? "on" : ""} disabled={!canVote} title={title} onClick={onDown} aria-label="Thumbs down">▼</button>
    </div>
  );
}

function Question({
  q, canVote, busy, onVote, onAnswer, onChallenge, onAppeal, onReport,
}: {
  q: QaQuestion;
  canVote: boolean;
  busy: boolean;
  onVote: (t: { questionId?: string; answerId?: string }, cur: number, v: 1 | -1) => void;
  onAnswer: (text: string) => Promise<boolean>;
  onChallenge: (a: QaAnswer) => void;
  onAppeal: (a: QaAnswer) => void;
  onReport: (t: ReportTarget) => void;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const iAnswered = q.answers.some((a) => a.mine);
  return (
    <div className="qa-q">
      <div className="qa-row">
        <Votes score={q.score} mine={q.myVote} canVote={canVote && !q.mine}
          onUp={() => onVote({ questionId: q.id }, q.myVote, 1)} onDown={() => onVote({ questionId: q.id }, q.myVote, -1)} />
        <div className="qa-body">
          {q.hidden && <div className="qa-hidden">Hidden by moderation. Only you can see this.</div>}
          <div className="qa-text">{q.text}</div>
          <div className="qa-meta">{q.author}{q.mine && " (you)"}{!q.mine && <button className="qa-link qa-report" onClick={() => onReport({ kind: "question", id: q.id })}>Report</button>}</div>
          {q.aiAnswer && (
            <details className="qa-ai">
              <summary>AI-written reference answer</summary>
              <p>{q.aiAnswer}</p>
              <span className="qa-tag">AI-generated. It can be wrong.</span>
            </details>
          )}
        </div>
      </div>

      {q.answers.map((a) => (
        <div key={a.id} className="qa-row qa-a">
          <Votes score={a.score} mine={a.myVote} canVote={canVote && !a.mine}
            onUp={() => onVote({ answerId: a.id }, a.myVote, 1)} onDown={() => onVote({ answerId: a.id }, a.myVote, -1)} />
          <div className="qa-body">
            {a.hidden && <div className="qa-hidden">Hidden by moderation. Only you can see this.</div>}
            <div className="qa-text">{a.text}</div>
            <div className="qa-meta">
              {a.author}{a.mine && " (you)"}{!a.mine && <button className="qa-link qa-report" onClick={() => onReport({ kind: "answer", id: a.id })}>Report</button>}
              {a.verdict ? (
                <span className={`qa-verdict v-${a.verdict.toLowerCase()}`}>AI judged: {VERDICT_LABEL[a.verdict]}</span>
              ) : (
                <span className="qa-verdict v-unsure">Not judged yet</span>
              )}
            </div>
            {a.aiReason && <div className="qa-reason">{a.aiReason} <span className="qa-tag">AI-generated judgement{a.challenged && ", re-assessed"}</span></div>}
            {a.mine && a.verdict !== "CORRECT" && !a.challenged && (
              <button className="qa-link" onClick={() => onChallenge(a)}>
                {a.verdict === null ? "Ask the AI to judge" : "Challenge this judgement"}
              </button>
            )}
            {a.mine && a.verdict !== "CORRECT" && a.verdict !== null && a.challenged && !a.appeal && (
              <button className="qa-link" onClick={() => onAppeal(a)}>Still wrong? Ask an admin to review</button>
            )}
            {a.appeal === "OPEN" && <span className="qa-tag">An admin will review this. Only you and the admins can see it.</span>}
            {a.appeal === "UPHELD" && <span className="qa-tag">An admin reviewed this and kept the judgement.</span>}
            {a.appeal === "OVERTURNED" && <span className="qa-tag">An admin overturned the judgement.</span>}
          </div>
        </div>
      ))}

      {!iAnswered && (
        open ? (
          <div className="qa-reply">
            <textarea className="input qa-input" placeholder="Your answer…" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
            <div className="set-row" style={{ marginTop: 8 }}>
              <button className="btn btn-primary btn-sm" disabled={busy || text.trim().length < 10}
                onClick={async () => { if (await onAnswer(text)) { setText(""); setOpen(false); } }}>
                {busy ? "Judging…" : "Submit answer"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="qa-link" onClick={() => setOpen(true)}>Answer this question</button>
        )
      )}
    </div>
  );
}

function ChallengeDialog({
  answer, onClose, onSubmit,
}: {
  answer: QaAnswer;
  onClose: () => void;
  onSubmit: (explanation: string) => Promise<{ ok: boolean; data: { message?: string; error?: string; overturned?: boolean; verdict?: string } }>;
}) {
  const unjudged = answer.verdict === null;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    const r = await onSubmit(text);
    setBusy(false);
    if (!r.ok) return setErr(r.data.message || r.data.error || "Something went wrong.");
    setDone(unjudged ? `The AI judged it: ${r.data.verdict}.` : r.data.overturned ? `The AI changed its judgement to ${r.data.verdict}.` : "The AI re-assessed it and kept its judgement. You can now ask an admin to review it.");
  }

  return (
    <div className="qa-modal-scrim" onClick={onClose}>
      <div className="qa-modal" role="dialog" aria-modal="true" aria-label="Challenge a judgement" onClick={(e) => e.stopPropagation()}>
        <h4>{unjudged ? "Ask the AI to judge this answer" : "Challenge this judgement"}</h4>
        {done ? (
          <>
            <p>{done}</p>
            <button className="btn btn-primary btn-sm" onClick={onClose}>Close</button>
          </>
        ) : (
          <>
            {!unjudged && (
              <>
                <p className="qa-quote">&ldquo;{answer.text}&rdquo; was judged <b>{answer.verdict}</b>: {answer.aiReason}</p>
                <label htmlFor="qa-expl" className="qa-lbl">What is wrong with the judgement?</label>
                <textarea id="qa-expl" className="input qa-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Explain what the AI got wrong…" />
                <p className="phelp">The AI re-assesses once, with your explanation. If it still marks your answer wrong, you can ask an admin to review it. Only you and the admins can see this.</p>
              </>
            )}
            {err && <div className="formerr">{err}</div>}
            <div className="set-row">
              <button className="btn btn-primary btn-sm" disabled={busy || (!unjudged && text.trim().length < 10)} onClick={go}>
                {busy ? "Asking the AI…" : unjudged ? "Judge it" : "Submit challenge"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
