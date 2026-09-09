"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Markdown from "./Markdown";

export type BoardResource = {
  id: string;
  type: string;
  title: string;
  url: string;
  author: string;
  durationMin: number | null;
  note: string;
};
export type BoardModule = {
  id: string;
  code: string;
  title: string;
  topic: string;
  timeSlot: string;
  duration: string;
  summary: string;
  body: string;
  resources: BoardResource[];
};
export type BoardSection = {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  modules: BoardModule[];
};
export type BoardCourse = {
  title: string;
  subtitle: string;
  description: string;
  sections: BoardSection[];
};

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function Board({
  course,
  initialModules,
  initialResources,
  isAuthed,
  firstName,
}: {
  course: BoardCourse;
  initialModules: string[];
  initialResources: string[];
  isAuthed: boolean;
  firstName: string | null;
}) {
  const router = useRouter();
  const [doneMods, setDoneMods] = useState<Set<string>>(new Set(initialModules));
  const [doneRes, setDoneRes] = useState<Set<string>>(new Set(initialResources));
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const allModules = useMemo(
    () => course.sections.flatMap((s) => s.modules.map((m) => ({ m, section: s }))),
    [course]
  );
  const total = allModules.length;
  const doneCount = allModules.filter(({ m }) => doneMods.has(m.id)).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const resume = useMemo(
    () => allModules.find(({ m }) => !doneMods.has(m.id))?.m ?? null,
    [allModules, doneMods]
  );

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const persist = useCallback(
    async (payload: { moduleId?: string; resourceId?: string; completed: boolean }) => {
      try {
        const res = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
      } catch {
        flash("Couldn't save — check your connection.");
      }
    },
    [flash]
  );

  const gate = useCallback(() => {
    flash("Create a free account to save your progress →");
  }, [flash]);

  const toggleModule = useCallback(
    (id: string) => {
      if (!isAuthed) return gate();
      setDoneMods((prev) => {
        const next = new Set(prev);
        const now = !next.has(id);
        if (now) next.add(id);
        else next.delete(id);
        persist({ moduleId: id, completed: now });
        return next;
      });
    },
    [isAuthed, gate, persist]
  );

  const toggleResource = useCallback(
    (id: string) => {
      if (!isAuthed) return gate();
      setDoneRes((prev) => {
        const next = new Set(prev);
        const now = !next.has(id);
        if (now) next.add(id);
        else next.delete(id);
        persist({ resourceId: id, completed: now });
        return next;
      });
    },
    [isAuthed, gate, persist]
  );

  const openMod = allModules.find(({ m }) => m.id === openId)?.m ?? null;

  function phaseTag(kicker: string) {
    const first = kicker.split("·")[0].trim();
    return first.replace(/\s*—.*$/, "");
  }

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div>
          <div className="hero-eyebrow">Practical AI for public administration</div>
          <h1 className="serif">
            Learn AI fast. Apply it to strategy and decisions <em>immediately</em>.
          </h1>
          <p className="hero-sub">{course.subtitle}</p>
          <div className="hero-cta">
            {resume ? (
              <button className="btn btn-primary" onClick={() => setOpenId(resume.id)}>
                {doneCount === 0 ? "Start The List" : "Resume"} · {resume.title}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => setOpenId(allModules[0]?.m.id ?? null)}>
                Review The List
              </button>
            )}
            <a className="btn btn-ghost" href="#curriculum">Browse the programme</a>
          </div>
        </div>

        <div className="hero-side">
          <div className="ringcard">
            <div className="ring" style={{ "--p": pct } as React.CSSProperties}>
              <b>{pct}%</b>
            </div>
            <div className="meta">
              <span className="rlabel">{isAuthed ? `Welcome, ${firstName}` : "Your progress"}</span>
              <b>{doneCount} / {total} modules</b>
              {isAuthed ? "Ticked boxes are saved to your account." : "Sign in to save your ticks across devices."}
            </div>
          </div>
          <div className="statmini">
            <div>
              <div className="n">2</div>
              <div className="l">Days learning</div>
            </div>
            <div>
              <div className="n">30</div>
              <div className="l">Days practice</div>
            </div>
          </div>
        </div>
      </section>

      {/* THE LIST */}
      <div className="sec-head" id="map">
        <span className="kick">The List</span>
        <div className="sec-line" />
        <span className="map-phase-tag">The programme, mapped to what you'll actually do</span>
      </div>

      <div className="map">
        <div className="map-head">
          <div className="h-topic">Topic</div>
          <div>What you'll actually do</div>
          <div className="h-time">Time</div>
          <div style={{ textAlign: "center" }}>Done</div>
        </div>
        {allModules.map(({ m, section }) => {
          const done = doneMods.has(m.id);
          return (
            <div
              key={m.id}
              className={`map-row${done ? " done" : ""}`}
              onClick={() => setOpenId(m.id)}
            >
              <div className="c-topic map-topic">
                {m.topic || <span style={{ color: "var(--fg-mute)" }}>—</span>}
                <div className="map-phase-tag" style={{ marginTop: 3 }}>{phaseTag(section.kicker)}</div>
              </div>
              <div className="map-mod">{m.title}</div>
              <div className="c-time map-time">{m.duration || m.timeSlot || "—"}</div>
              <div style={{ display: "grid", placeItems: "center" }} onClick={(e) => e.stopPropagation()}>
                <button
                  className={`tick${done ? " on" : ""}`}
                  aria-label={done ? "Mark incomplete" : "Mark complete"}
                  onClick={() => toggleModule(m.id)}
                >
                  <Check />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!isAuthed && (
        <div className="gate">
          <span>Following along without an account. Your ticks won't be saved.</span>
          <a href="/register" className="btn btn-primary btn-sm">Create a free account</a>
        </div>
      )}

      {/* PHASE BOARD */}
      <div id="curriculum" />
      {course.sections.map((s) => (
        <section key={s.id} className="phase" id={s.id === course.sections.at(-1)?.id ? "sources" : undefined}>
          <div className="sec-head">
            <span className="kick">{s.kicker}</span>
            <div className="sec-line" />
          </div>
          <h2 className="serif" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>{s.title}</h2>
          {s.subtitle && <p className="phase-intro">{s.subtitle}</p>}
          <div className="cards">
            {s.modules.map((m) => {
              const done = doneMods.has(m.id);
              return (
                <button key={m.id} className={`modcard${done ? " done" : ""}`} onClick={() => setOpenId(m.id)}>
                  <div className="modcard-top">
                    <span className="modcard-code">{m.code || "—"}</span>
                    <span
                      className={`tick${done ? " on" : ""}`}
                      role="button"
                      aria-label={done ? "Mark incomplete" : "Mark complete"}
                      onClick={(e) => { e.stopPropagation(); toggleModule(m.id); }}
                    >
                      <Check />
                    </span>
                  </div>
                  <h4 className="serif">{m.title}</h4>
                  {m.summary && <p className="sum">{m.summary}</p>}
                  <div className="modcard-foot">
                    {(m.duration || m.timeSlot) && (
                      <span className="pill time">{m.duration || m.timeSlot}</span>
                    )}
                    {m.resources.length > 0 && (
                      <span className="rescount">
                        {m.resources.filter((r) => doneRes.has(r.id)).length}/{m.resources.length} resources
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {/* DRAWER */}
      {openMod && (
        <>
          <div className="scrim" onClick={() => setOpenId(null)} />
          <aside className="drawer" role="dialog" aria-modal="true">
            <div className="drawer-head">
              <button className="drawer-close" onClick={() => setOpenId(null)} aria-label="Close">✕</button>
              {openMod.code && <div className="code">{openMod.code}</div>}
              <h3>{openMod.title}</h3>
              <div className="meta">
                {openMod.topic && <span className="pill">↳ {openMod.topic}</span>}
                {openMod.timeSlot && <span className="pill time">{openMod.timeSlot}</span>}
                {openMod.duration && <span className="pill">{openMod.duration}</span>}
              </div>
              <div style={{ marginTop: 16 }}>
                <button
                  className={doneMods.has(openMod.id) ? "btn btn-ghost btn-sm" : "btn btn-iris btn-sm"}
                  onClick={() => toggleModule(openMod.id)}
                >
                  {doneMods.has(openMod.id) ? "✓ Completed — undo" : "Mark module complete"}
                </button>
              </div>
            </div>
            <div className="drawer-body">
              {openMod.summary && (
                <p style={{ color: "var(--fg)", fontSize: 15, lineHeight: 1.55, marginBottom: 18 }}>
                  {openMod.summary}
                </p>
              )}
              {openMod.body && <Markdown source={openMod.body} />}

              {openMod.resources.length > 0 && (
                <>
                  <div className="sec-head" style={{ margin: "26px 0 12px" }}>
                    <span className="kick">Resources</span>
                    <div className="sec-line" />
                  </div>
                  <div className="reslist">
                    {openMod.resources.map((r) => {
                      const rdone = doneRes.has(r.id);
                      return (
                        <div key={r.id} className={`resitem${rdone ? " done" : ""}`}>
                          <button
                            className={`tick${rdone ? " on" : ""}`}
                            onClick={() => toggleResource(r.id)}
                            aria-label={rdone ? "Mark unwatched" : "Mark watched"}
                          >
                            <Check />
                          </button>
                          <div className="res-main">
                            <div className="res-title">
                              {r.url ? (
                                <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title} ↗</a>
                              ) : (
                                r.title
                              )}
                            </div>
                            <div className="res-meta">
                              <span className={`rtype ${r.type}`}>{r.type}</span>
                              {r.author && <span>{r.author}</span>}
                              {r.durationMin != null && <span>· {r.durationMin} min</span>}
                            </div>
                            {r.note && <div className="res-note">{r.note}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </aside>
        </>
      )}

      {toast && (
        <div className="toast">
          {toast.includes("account") ? (
            <a href="/register">{toast}</a>
          ) : (
            toast
          )}
        </div>
      )}
    </>
  );
}
