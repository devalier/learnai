"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Field = { key: string; label: string; kind?: "text" | "textarea" | "number" | "select"; options?: string[]; placeholder?: string; dynamic?: string };

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
  region: [
    { key: "name", label: "Name" },
    { key: "slug", label: "Slug (auto if blank)", placeholder: "foundations" },
    { key: "blurb", label: "Blurb", kind: "textarea" },
    { key: "labelX", label: "Label X", kind: "number" },
    { key: "labelY", label: "Label Y", kind: "number" },
    { key: "order", label: "Order", kind: "number" },
  ],
  node: [
    { key: "title", label: "Title" },
    { key: "slug", label: "Slug (auto if blank)", placeholder: "what-ai-is" },
    { key: "summary", label: "Summary (one sentence)", kind: "textarea" },
    { key: "kind", label: "Kind", kind: "select", options: ["CONCEPT", "DECISION", "CONSTRAINT"] },
    { key: "regionId", label: "Region", kind: "select", dynamic: "regions" },
    { key: "legacyModuleCode", label: "Legacy module code", placeholder: "D1-A" },
    { key: "contentVersion", label: "Content version", kind: "number" },
    { key: "material", label: "Material change (thins holdings)", kind: "select", options: ["false", "true"] },
    { key: "x", label: "X", kind: "number" },
    { key: "y", label: "Y", kind: "number" },
    { key: "order", label: "Order", kind: "number" },
  ],
  edge: [
    { key: "fromId", label: "From node", kind: "select", dynamic: "nodes" },
    { key: "toId", label: "To node", kind: "select", dynamic: "nodes" },
    { key: "kind", label: "Kind", kind: "select", options: ["REFINES", "ADJACENT", "TENSION"] },
    { key: "weight", label: "Weight", kind: "number" },
  ],
  nodeReference: [
    { key: "title", label: "Title" },
    { key: "url", label: "URL" },
    { key: "kind", label: "Type", kind: "select", options: ["VIDEO", "COURSE", "ARTICLE", "EXERCISE"] },
    { key: "author", label: "Author / source" },
    { key: "legacyModuleCode", label: "Legacy module code" },
    { key: "order", label: "Order", kind: "number" },
  ],
};

type DynOpt = { value: string; label: string };
type DynamicOptions = Record<string, DynOpt[]>;

type AnyRec = Record<string, any>;

function optionsFor(f: Field, dynamicOptions?: DynamicOptions): DynOpt[] {
  if (f.dynamic) return dynamicOptions?.[f.dynamic] ?? [];
  return (f.options ?? []).map((o) => ({ value: o, label: o }));
}

function EntityForm({
  type,
  initial,
  parent,
  dynamicOptions,
  onDone,
  onCancel,
}: {
  type: keyof typeof FORMS;
  initial?: AnyRec;
  parent?: { key: string; id: string };
  dynamicOptions?: DynamicOptions;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<AnyRec>(() => {
    const v: AnyRec = {};
    for (const f of FORMS[type]) {
      if (initial?.[f.key] !== undefined && initial?.[f.key] !== null) v[f.key] = initial[f.key];
      else if (f.kind === "number") v[f.key] = 0;
      else if (f.kind === "select") v[f.key] = optionsFor(f, dynamicOptions)[0]?.value ?? "";
      else v[f.key] = "";
    }
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
              <select className="input" value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}>
                {optionsFor(f, dynamicOptions).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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

export default function AdminConsole({
  courses,
  studentCount,
  graph,
}: {
  courses: AnyRec[];
  studentCount: number;
  graph: { regions: AnyRec[]; nodes: AnyRec[]; edges: AnyRec[] };
}) {
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
        <div style={{ padding: "6px 13px", marginTop: 14, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-mute)" }}>Lattice</div>
        <a onClick={() => setTab("graph")} style={{ cursor: "pointer", color: "var(--iris)", background: tab === "graph" ? "var(--panel)" : undefined }}>Knowledge graph</a>
        <div style={{ marginTop: 18, padding: "12px 13px", borderTop: "1px solid var(--line)", fontSize: 13, color: "var(--fg-dim)" }}>
          <b style={{ color: "var(--fg)", fontFamily: "var(--serif)", fontSize: 22, display: "block" }}>{studentCount}</b>
          registered student{studentCount === 1 ? "" : "s"}
        </div>
      </nav>

      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
          <h1 className="serif" style={{ fontSize: 30 }}>{tab === "graph" ? "Knowledge graph" : tab === "new" ? "Create a course" : "Configure course"}</h1>
        </div>

        {tab === "graph" ? (
          <GraphAdmin graph={graph} />
        ) : tab === "new" ? (
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

function GraphAdmin({ graph }: { graph: { regions: AnyRec[]; nodes: AnyRec[]; edges: AnyRec[] } }) {
  const { refresh, del } = useMut();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const isEdit = (t: string, id: string) => editing === `${t}:${id}`;
  const isAdd = (t: string, pid: string) => adding === `${t}:${pid}`;
  const done = () => { setEditing(null); setAdding(null); refresh(); };

  const dyn: DynamicOptions = {
    regions: graph.regions.map((r) => ({ value: r.id, label: r.name })),
    nodes: graph.nodes.map((n) => ({ value: n.id, label: n.title })),
  };
  const regionIds = new Set(graph.regions.map((r) => r.id));
  const unfiled = graph.nodes.filter((n) => !n.regionId || !regionIds.has(n.regionId));

  const nodeBlock = (node: AnyRec) => (
    <div key={node.id}>
      <div className="adm-item">
        <span className="tag" style={{ color: "var(--iris)" }}>{String(node.kind).toLowerCase()}</span>
        <div className="t">
          <b>{node.title}</b>
          <small>/{node.slug}{node.legacyModuleCode ? ` · ${node.legacyModuleCode}` : ""} · {(node.references?.length ?? 0)} refs{node.material ? " · material" : ""}</small>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(isEdit("node", node.id) ? null : `node:${node.id}`)}>Edit</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setAdding(isAdd("nodeReference", node.id) ? null : `nodeReference:${node.id}`)}>+ Ref</button>
        <button className="btn btn-danger btn-sm" onClick={() => del("node", node.id)}>Delete</button>
      </div>
      {isEdit("node", node.id) && <EntityForm type="node" initial={node} dynamicOptions={dyn} onDone={done} onCancel={() => setEditing(null)} />}
      {isAdd("nodeReference", node.id) && <EntityForm type="nodeReference" parent={{ key: "nodeId", id: node.id }} onDone={done} onCancel={() => setAdding(null)} />}
      {(node.references?.length ?? 0) > 0 && (
        <div className="grow-list" style={{ marginTop: 8, paddingLeft: 14 }}>
          {node.references.map((r: AnyRec) => (
            <div key={r.id}>
              <div className="adm-item" style={{ background: "var(--panel)" }}>
                <span className={`rtype ${r.kind}`}>{r.kind}</span>
                <div className="t"><b style={{ fontSize: 13 }}>{r.title}</b><small>{r.url || "no url"}</small></div>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(isEdit("nodeReference", r.id) ? null : `nodeReference:${r.id}`)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => del("nodeReference", r.id)}>Delete</button>
              </div>
              {isEdit("nodeReference", r.id) && <EntityForm type="nodeReference" initial={r} onDone={done} onCancel={() => setEditing(null)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <p className="phelp">
        The shared knowledge graph behind the <a href="/map" style={{ color: "var(--iris)" }}>map</a>. Nodes and edges
        are seeded from The List but fully editable here — The List itself is unchanged and edited under Courses.
      </p>

      {graph.regions.map((r) => (
        <div className="panel" key={r.id}>
          <div className="adm-item" style={{ border: "none", background: "transparent", padding: 0, marginBottom: 8 }}>
            <span className="tag" style={{ color: "var(--amber)" }}>REGION</span>
            <div className="t"><b>{r.name}</b><small>/{r.slug} · {graph.nodes.filter((n) => n.regionId === r.id).length} nodes</small></div>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(isEdit("region", r.id) ? null : `region:${r.id}`)}>Edit</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding(isAdd("node", r.id) ? null : `node:${r.id}`)}>+ Node</button>
            <button className="btn btn-danger btn-sm" onClick={() => del("region", r.id)}>Delete</button>
          </div>
          {isEdit("region", r.id) && <EntityForm type="region" initial={r} onDone={done} onCancel={() => setEditing(null)} />}
          <div className="grow-list" style={{ marginTop: 10, paddingLeft: 12, borderLeft: "2px solid var(--line)" }}>
            {graph.nodes.filter((n) => n.regionId === r.id).map(nodeBlock)}
            {isAdd("node", r.id) ? (
              <EntityForm type="node" parent={{ key: "regionId", id: r.id }} initial={{ regionId: r.id }} dynamicOptions={dyn} onDone={done} onCancel={() => setAdding(null)} />
            ) : (
              <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setAdding(`node:${r.id}`)}>+ Add node</button>
            )}
          </div>
        </div>
      ))}

      {isAdd("region", "root") ? (
        <EntityForm type="region" onDone={done} onCancel={() => setAdding(null)} />
      ) : (
        <button className="btn btn-iris btn-sm" onClick={() => setAdding("region:root")}>+ Add region</button>
      )}

      {unfiled.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="adm-item" style={{ border: "none", background: "transparent", padding: 0, marginBottom: 8 }}>
            <span className="tag">UNFILED</span>
            <div className="t"><b>Nodes without a region</b><small>{unfiled.length} nodes</small></div>
          </div>
          <div className="grow-list" style={{ marginTop: 10, paddingLeft: 12, borderLeft: "2px solid var(--line)" }}>
            {unfiled.map(nodeBlock)}
          </div>
        </div>
      )}

      {/* EDGES */}
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="adm-item" style={{ border: "none", background: "transparent", padding: 0, marginBottom: 8 }}>
          <span className="tag" style={{ color: "var(--iris)" }}>EDGES</span>
          <div className="t"><b>Edges</b><small>{graph.edges.length} · typed relations, never prerequisites</small></div>
          <button className="btn btn-ghost btn-sm" onClick={() => setAdding(isAdd("edge", "root") ? null : "edge:root")}>+ Add edge</button>
        </div>
        {isAdd("edge", "root") && <EntityForm type="edge" dynamicOptions={dyn} onDone={done} onCancel={() => setAdding(null)} />}
        <div className="grow-list" style={{ marginTop: 8 }}>
          {graph.edges.map((e: AnyRec) => (
            <div key={e.id}>
              <div className="adm-item" style={{ background: "var(--panel)" }}>
                <span className="tag">{e.kind}</span>
                <div className="t"><b style={{ fontSize: 13 }}>{e.from?.title ?? e.fromId} → {e.to?.title ?? e.toId}</b><small>weight {e.weight}</small></div>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(isEdit("edge", e.id) ? null : `edge:${e.id}`)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => del("edge", e.id)}>Delete</button>
              </div>
              {isEdit("edge", e.id) && <EntityForm type="edge" initial={e} dynamicOptions={dyn} onDone={done} onCancel={() => setEditing(null)} />}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
