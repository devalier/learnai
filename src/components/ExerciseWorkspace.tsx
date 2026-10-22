"use client";

import { useEffect, useMemo, useState } from "react";
import type { Exercise } from "@/lib/exercises";

type Saved = { v: Record<string, string>; d: boolean[] };

const key = (code: string) => `learnai_ex_v1_${code}`;

function load(ex: Exercise): Saved {
  const empty: Saved = { v: {}, d: Array(ex.days ?? 0).fill(false) };
  try {
    const raw = localStorage.getItem(key(ex.code));
    if (!raw) return empty;
    const s = JSON.parse(raw) as Partial<Saved>;
    const v: Record<string, string> = s.v && typeof s.v === "object" ? { ...s.v } : {};
    // answers saved before an option was renamed keep counting
    const renamed = ex.score?.renamed;
    if (renamed) for (const [id, val] of Object.entries(v)) if (renamed[val]) v[id] = renamed[val];
    return {
      v,
      d: ex.days ? Array.from({ length: ex.days }, (_, i) => !!s.d?.[i]) : [],
    };
  } catch {
    return empty;
  }
}

/**
 * A worksheet for one exercise. Answers are kept in this browser only
 * (localStorage) and never sent to the server. "Copy as text" is how a learner
 * takes the result away.
 */
export default function ExerciseWorkspace({
  ex,
  done,
  onToggleDone,
}: {
  ex: Exercise;
  done: boolean;
  onToggleDone: () => void;
}) {
  const [saved, setSaved] = useState<Saved>({ v: {}, d: Array(ex.days ?? 0).fill(false) });
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setSaved(load(ex));
    setReady(true);
  }, [ex]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key(ex.code), JSON.stringify(saved));
    } catch {
      // storage blocked: the worksheet still works for this visit
    }
  }, [saved, ready, ex.code]);

  const setVal = (id: string, value: string) =>
    setSaved((s) => ({ ...s, v: { ...s.v, [id]: value } }));
  const toggleDay = (i: number) =>
    setSaved((s) => ({ ...s, d: s.d.map((x, j) => (j === i ? !x : x)) }));

  const filled = useMemo(
    () => ex.groups.flatMap((g) => g.fields).filter((f) => (saved.v[f.id] ?? "").trim()).length,
    [ex, saved.v]
  );
  const total = useMemo(() => ex.groups.flatMap((g) => g.fields).length, [ex]);
  const score = ex.score
    ? ex.groups.filter((g) => g.fields.some((f) => f.id.endsWith(ex.score!.fieldSuffix))).length
    : 0;
  const good = ex.score
    ? Object.entries(saved.v).filter(([id, val]) => id.endsWith(ex.score!.fieldSuffix) && val === ex.score!.good).length
    : 0;
  const daysDone = saved.d.filter(Boolean).length;

  function say(msg: string) {
    setNote(msg);
    window.setTimeout(() => setNote(null), 2200);
  }

  async function copy() {
    const lines = [`${ex.title}`, ""];
    if (ex.days) lines.push(`Days done: ${daysDone}/${ex.days}`, "");
    for (const g of ex.groups) {
      lines.push(`## ${g.title}`);
      for (const f of g.fields) lines.push(`${f.label}: ${(saved.v[f.id] ?? "").trim() || "-"}`);
      lines.push("");
    }
    if (ex.score) lines.push(`Score: ${good}/${score} ${ex.score.label}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n").trim());
      say("Copied.");
    } catch {
      say("Couldn't copy. Select the text by hand.");
    }
  }

  function clear() {
    if (!window.confirm("Clear everything you have written in this worksheet?")) return;
    setSaved({ v: {}, d: Array(ex.days ?? 0).fill(false) });
  }

  return (
    <div className="exws">
      <div className="exws-block">
        <div className="exws-h">Why</div>
        <p>{ex.why}</p>
      </div>
      <div className="exws-block">
        <div className="exws-h">How{ex.minutes ? ` · ~${ex.minutes} min` : ""}</div>
        <ol>
          {ex.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>
      {ex.warn && <div className="exws-warn">{ex.warn}</div>}

      {ex.pack && (
        <div className="exws-block">
          <div className="exws-h">Material</div>
          <p>{ex.pack.intro}</p>
          <p><b>{ex.pack.source.title}</b></p>
          <p>{ex.pack.source.text}</p>
          {ex.pack.items.map((it) => (
            <p key={it.title}><b>{it.title}.</b> {it.text}</p>
          ))}
          <details>
            <summary>Answer key (open after you have marked)</summary>
            <ul>
              {ex.pack.key.map((k, i) => (
                <li key={i}>{k}</li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {ex.days != null && (
        <div className="exws-block">
          <div className="exws-h">
            Days done · {daysDone}/{ex.days}
          </div>
          <div className="exws-days">
            {saved.d.map((on, i) => (
              <button
                key={i}
                type="button"
                className={`exws-day${on ? " on" : ""}`}
                aria-pressed={on}
                aria-label={`Day ${i + 1}`}
                onClick={() => toggleDay(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {ex.groups.map((g) => (
        <fieldset key={g.title} className="exws-group">
          <legend>{g.title}</legend>
          {g.note && <p className="exws-note">{g.note}</p>}
          {g.fields.map((f) => {
            const id = `ex-${ex.code}-${f.id}`;
            return (
              <div className="field" key={f.id}>
                <label htmlFor={id}>{f.label}</label>
                {f.hint && <div className="exws-hint">{f.hint}</div>}
                {f.kind === "area" ? (
                  <textarea
                    id={id}
                    className="input"
                    rows={3}
                    value={saved.v[f.id] ?? ""}
                    onChange={(e) => setVal(f.id, e.target.value)}
                  />
                ) : f.kind === "choice" ? (
                  <select
                    id={id}
                    className="input"
                    value={saved.v[f.id] ?? ""}
                    onChange={(e) => setVal(f.id, e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {f.options?.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    className="input"
                    value={saved.v[f.id] ?? ""}
                    onChange={(e) => setVal(f.id, e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </fieldset>
      ))}

      {ex.score && (
        <div className="exws-score">
          {good}/{score} {ex.score.label}
        </div>
      )}

      <div className="exws-bar">
        <span className="exws-meta">
          {filled}/{total} filled · saved on this device only
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
          Copy as text
        </button>
        <button type="button" className="btn btn-danger btn-sm" onClick={clear}>
          Clear
        </button>
        <button type="button" className={done ? "btn btn-ghost btn-sm" : "btn btn-iris btn-sm"} onClick={onToggleDone}>
          {done ? "✓ Done — undo" : "Mark exercise done"}
        </button>
        {note && <span className="exws-meta" role="status">{note}</span>}
      </div>
    </div>
  );
}
