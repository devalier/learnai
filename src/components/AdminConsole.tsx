"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Field = { key: string; label: string; kind?: "text" | "textarea" | "number" | "select"; options?: string[]; placeholder?: string };

const FORMS: Record<string, Field[]> = {
  course: [
    { key: "title", label: "Title" },
    { key: "subtitle", label: "Subtitle" },
    { key: "description", label: "Description", kind: "textarea" },
    { key: "order", label: "Order", kind: "number" },
  ],
  section: [
    { key: "kicker", label: "Kicker (eyebrow)", placeholder: "Day 1 · Mechanics without romance" },
    { key: "title", label: "Title" },
    { key: "subtitle", label: "Subtitle / intro", kind: "textarea" },
    { key: "order", label: "Order", kind: "number" },
  ],
  module: [
    { key: "code", label: "Code", placeholder: "D1-A" },
    { key: "title", label: "Title" },
    { key: "topic", label: "Topic", placeholder: "Foundations: how a language model works" },
    { key: "timeSlot", label: "Time slot", placeholder: "09:20–10:50" },
    { key: "duration", label: "Duration", placeholder: "90 min" },
    { key: "summary", label: "Summary (card blurb)", kind: "textarea" },
    { key: "body", label: "Body (markdown: **bold**, - lists, | tables |)", kind: "textarea" },
    { key: "order", label: "Order", kind: "number" },
  ],
  resource: [
    { key: "type", label: "Type", kind: "select", options: ["VIDEO", "COURSE", "ARTICLE", "EXERCISE"] },
    { key: "title", label: "Title" },
    { key: "url", label: "URL" },
    { key: "author", label: "Author / source" },
    { key: "durationMin", label: "Duration (min)", kind: "number" },
    { key: "note", label: "Note", kind: "textarea" },
    { key: "order", label: "Order", kind: "number" },
  ],
};

type AnyRec = Record<string, any>;

function EntityForm({
  type,
  initial,
  parent,
  onDone,
  onCancel,
}: {
  type: keyof typeof FORMS;
  initial?: AnyRec;
  parent?: { key: string; id: string };
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<AnyRec>(() => {
    const v: AnyRec = {};
    for (const f of FORMS[type]) v[f.key] = initial?.[f.key] ?? (f.kind === "number" ? 0 : f.kind === "select" ? f.options?.[0] : "");
    return v;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const editing = !!initial?.id;

  async function save() {
    setBusy(true);
    setErr(null);
    const payload: AnyRec = { ...values };
    if (editing) payload.id = initial!.id;
    if (parent) payload[parent.key] = parent.id;
    const res = await fetch(`/api/admin/${type}`, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Failed");
      return;
    }
    onDone();
  }

  return (
    <div className="panel" style={{ background: "var(--ink-2)", marginTop: 10 }}>
      <div className="grow-list">
        {FORMS[type].map((f) => (
          <div className="field" key={f.key} style={{ marginTop: 0 }}>
            <label>{f.label}</label>
            {f.kind === "textarea" ? (
              <textarea className="input" value={values[f.key] ?? ""} placeholder={f.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
            ) : f.kind === "select" ? (
              <select className="input" value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}>
                {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input className="input" type={f.kind === "number" ? "number" : "text"} value={values[f.key] ?? ""} placeholder={f.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: f.kind === "number" ? Number(e.target.value) : e.target.value }))} />
            )}
          </div>
        ))}
      </div>
      {err && <div className="formerr">{err}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : `Add ${type}`}
        </button>
        {onCancel && <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

function useMut() {
  const router = useRouter();
  return {
    refresh: () => router.refresh(),
    del: async (type: string, id: string) => {
      if (!confirm(`Delete this ${type}? Child items are removed too.`)) return false;
      await fetch(`/api/admin/${type}?id=${id}`, { method: "DELETE" });
      router.refresh();
      return true;
    },
  };
}

export default function AdminConsole({ courses, studentCount }: { courses: AnyRec[]; studentCount: number }) {
  const { refresh, del } = useMut();
  const [tab, setTab] = useState<string>(courses[0]?.id ?? "new");
  const [editing, setEditing] = useState<string | null>(null); // key: `${type}:${id}`
  const [adding, setAdding] = useState<string | null>(null); // key: `${type}:${parentId}`
  const course = courses.find((c) => c.id === tab);

  const isEdit = (type: string, id: string) => editing === `${type}:${id}`;
  const isAdd = (type: string, pid: string) => adding === `${type}:${pid}`;
  const done = () => { setEditing(null); setAdding(null); refresh(); };

  return (
    <div className="admin-grid">
      <nav className="admin-rail">
        <div style={{ padding: "6px 13px", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-mute)" }}>Courses</div>
        {courses.map((c) => (
          <a key={c.id} onClick={() => setTab(c.id)} style={{ cursor: "pointer", background: tab === c.id ? "var(--panel)" : undefined, color: tab === c.id ? "var(--fg)" : undefined }}>
            {c.title}
          </a>
        ))}
        <a onClick={() => setTab("new")} style={{ cursor: "pointer", color: "var(--amber)", background: tab === "new" ? "var(--panel)" : undefined }}>+ New course</a>
        <div style={{ marginTop: 18, padding: "12px 13px", borderTop: "1px solid var(--line)", fontSize: 13, color: "var(--fg-dim)" }}>
          <b style={{ color: "var(--fg)", fontFamily: "var(--serif)", fontSize: 22, display: "block" }}>{studentCount}</b>
          registered student{studentCount === 1 ? "" : "s"}
        </div>
      </nav>

      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
          <h1 className="serif" style={{ fontSize: 30 }}>{tab === "new" ? "Create a course" : "Configure course"}</h1>
        </div>

        {tab === "new" ? (
          <EntityForm type="course" onDone={() => { setTab("new"); refresh(); }} />
        ) : course ? (
          <>
            <div className="panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <h3>{course.title} <span className="tag">/{course.slug}</span></h3>
                  <p className="phelp" style={{ marginBottom: 0 }}>{course.subtitle}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(isEdit("course", course.id) ? null : `course:${course.id}`)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => del("course", course.id).then((ok) => ok && setTab("new"))}>Delete</button>
                </div>
              </div>
              {isEdit("course", course.id) && <EntityForm type="course" initial={course} onDone={done} onCancel={() => setEditing(null)} />}
            </div>

            {/* SECTIONS */}
            {course.sections.map((s: AnyRec) => (
              <div className="panel" key={s.id}>
                <div className="adm-item" style={{ border: "none", background: "transparent", padding: 0, marginBottom: 8 }}>
                  <span className="tag" style={{ color: "var(--iris)" }}>SECTION</span>
                  <div className="t">
                    <b>{s.title}</b>
                    <small>{s.kicker}</small>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(isEdit("section", s.id) ? null : `section:${s.id}`)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => del("section", s.id)}>Delete</button>
                </div>
                {isEdit("section", s.id) && <EntityForm type="section" initial={s} onDone={done} onCancel={() => setEditing(null)} />}

                {/* MODULES */}
                <div className="grow-list" style={{ marginTop: 10, paddingLeft: 12, borderLeft: "2px solid var(--line)" }}>
                  {s.modules.map((m: AnyRec) => (
                    <div key={m.id}>
                      <div className="adm-item">
                        <span className="tag">{m.code || "—"}</span>
                        <div className="t">
                          <b>{m.title}</b>
                          <small>{[m.topic, m.duration].filter(Boolean).join(" · ")} · {m.resources.length} resources</small>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(isEdit("module", m.id) ? null : `module:${m.id}`)}>Edit</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setAdding(isAdd("resource", m.id) ? null : `resource:${m.id}`)}>+ Resource</button>
                        <button className="btn btn-danger btn-sm" onClick={() => del("module", m.id)}>Delete</button>
                      </div>
                      {isEdit("module", m.id) && <EntityForm type="module" initial={m} onDone={done} onCancel={() => setEditing(null)} />}
                      {isAdd("resource", m.id) && <EntityForm type="resource" parent={{ key: "moduleId", id: m.id }} onDone={done} onCancel={() => setAdding(null)} />}

                      {/* RESOURCES */}
                      {m.resources.length > 0 && (
                        <div className="grow-list" style={{ marginTop: 8, paddingLeft: 14 }}>
                          {m.resources.map((r: AnyRec) => (
                            <div key={r.id}>
                              <div className="adm-item" style={{ background: "var(--panel)" }}>
                                <span className={`rtype ${r.type}`}>{r.type}</span>
                                <div className="t">
                                  <b style={{ fontSize: 13 }}>{r.title}</b>
                                  <small>{r.url || "no url"}</small>
                                </div>
                                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(isEdit("resource", r.id) ? null : `resource:${r.id}`)}>Edit</button>
                                <button className="btn btn-danger btn-sm" onClick={() => del("resource", r.id)}>Delete</button>
                              </div>
                              {isEdit("resource", r.id) && <EntityForm type="resource" initial={r} onDone={done} onCancel={() => setEditing(null)} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {isAdd("module", s.id) ? (
                    <EntityForm type="module" parent={{ key: "sectionId", id: s.id }} onDone={done} onCancel={() => setAdding(null)} />
                  ) : (
                    <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setAdding(`module:${s.id}`)}>+ Add module</button>
                  )}
                </div>
              </div>
            ))}

            {isAdd("section", course.id) ? (
              <EntityForm type="section" parent={{ key: "courseId", id: course.id }} onDone={done} onCancel={() => setAdding(null)} />
            ) : (
              <button className="btn btn-iris btn-sm" onClick={() => setAdding(`section:${course.id}`)}>+ Add section</button>
            )}
          </>
        ) : (
          <p style={{ color: "var(--fg-dim)" }}>Select a course.</p>
        )}
      </div>
    </div>
  );
}
