"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GraphSlice, SliceNode } from "@/lib/graph";
import type { Position } from "@/lib/holdings";

type NodeDetail = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  kind: string;
  region: { id: string; name: string } | null;
  references: { id: string; url: string; title: string; kind: string; author: string }[];
  claims: { id: string; text: string; for: number; against: number; myStance: "FOR" | "AGAINST" | null }[];
  presence: { count: number; names: string[] };
  holdingState: "held" | "thin" | null;
};

const STATE_LABEL: Record<SliceNode["state"], string> = {
  held: "Held",
  frontier: "Frontier",
  thin: "Thin",
  mapped: "Mapped by others",
  unmapped: "Not yet mapped",
};

export default function MapView({
  slice,
  position,
  isAuthed,
  initialView,
}: {
  slice: GraphSlice;
  position: Position | null;
  isAuthed: boolean;
  initialView: "map" | "list";
}) {
  const router = useRouter();
  const [view, setView] = useState<"map" | "list">(initialView);
  const [selected, setSelected] = useState<string | null>(null); // node slug

  const nodeBySlug = useMemo(() => new Map(slice.nodes.map((n) => [n.slug, n])), [slice.nodes]);
  const nodeById = useMemo(() => new Map(slice.nodes.map((n) => [n.id, n])), [slice.nodes]);

  // Undirected neighbour index for edge traversal (used by panel + list view).
  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      if (!m.has(a)) m.set(a, new Set());
      m.get(a)!.add(b);
    };
    for (const e of slice.edges) {
      add(e.fromId, e.toId);
      add(e.toId, e.fromId);
    }
    return m;
  }, [slice.edges]);

  const switchView = useCallback(
    (v: "map" | "list") => {
      setView(v);
      const url = v === "list" ? "/map?view=list" : "/map";
      router.replace(url, { scroll: false });
    },
    [router]
  );

  const counters = position?.counters;

  return (
    <>
      <div className="map-topline">
        <div>
          <div className="kick" style={{ marginBottom: 6 }}>The map</div>
          <h1 className="serif" style={{ fontSize: 30, letterSpacing: "-0.02em" }}>
            A place, not a checklist
          </h1>
          <p style={{ color: "var(--fg-dim)", maxWidth: "60ch", marginTop: 8, fontSize: 14.5, lineHeight: 1.55 }}>
            Every node is one idea you can be right or wrong about. Solid marks are yours to defend,
            dashed marks are your frontier — one step from what you hold. Nothing is locked.
          </p>
        </div>
        <div className="map-controls">
          <div className="viewtoggle" role="tablist" aria-label="Map or list view">
            <button role="tab" aria-selected={view === "map"} className={view === "map" ? "on" : ""} onClick={() => switchView("map")}>
              Map
            </button>
            <button role="tab" aria-selected={view === "list"} className={view === "list" ? "on" : ""} onClick={() => switchView("list")}>
              List
            </button>
          </div>
          {counters && (
            <div className="map-counters" aria-label="Your position">
              <span><b>{counters.held}</b> held</span>
              <span><b>{counters.frontier}</b> frontier</span>
              <span><b>{counters.thin}</b> thin</span>
            </div>
          )}
        </div>
      </div>

      <MapLegend />

      {view === "map" ? (
        <GraphCanvas slice={slice} onSelect={setSelected} selected={selected} />
      ) : (
        <ListView slice={slice} nodeById={nodeById} onSelect={setSelected} />
      )}

      {selected && (
        <NodePanel
          slug={selected}
          isAuthed={isAuthed}
          neighbourSlugs={[...(neighbours.get(nodeBySlug.get(selected)?.id ?? "") ?? [])]
            .map((id) => nodeById.get(id))
            .filter(Boolean)
            .map((n) => n as SliceNode)}
          onClose={() => setSelected(null)}
          onNavigate={(slug) => setSelected(slug)}
        />
      )}
    </>
  );
}

function MapLegend() {
  const items: { state: SliceNode["state"]; label: string }[] = [
    { state: "held", label: "Held" },
    { state: "frontier", label: "Frontier" },
    { state: "thin", label: "Thin" },
    { state: "mapped", label: "Mapped by others" },
    { state: "unmapped", label: "Unmapped" },
  ];
  return (
    <div className="map-legend" aria-hidden="true">
      {items.map((i) => (
        <span key={i.state} className="legend-item">
          <span className={`legend-dot st-${i.state}`} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// ─── Map (SVG) view ──────────────────────────────────────────────────────────

function GraphCanvas({
  slice,
  onSelect,
  selected,
}: {
  slice: GraphSlice;
  onSelect: (slug: string) => void;
  selected: string | null;
}) {
  const nodeById = useMemo(() => new Map(slice.nodes.map((n) => [n.id, n])), [slice.nodes]);

  // Bounds → initial viewBox with padding.
  const bounds = useMemo(() => {
    const xs = slice.nodes.map((n) => n.x);
    const ys = slice.nodes.map((n) => n.y);
    const pad = 90;
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
    return { minX, minY, w: maxX - minX, h: maxY - minY };
  }, [slice.nodes]);

  const [vb, setVb] = useState({ x: bounds.minX, y: bounds.minY, w: bounds.w, h: bounds.h });
  useEffect(() => setVb({ x: bounds.minX, y: bounds.minY, w: bounds.w, h: bounds.h }), [bounds]);

  const drag = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setVb((v) => {
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      const nw = Math.min(bounds.w * 2.5, Math.max(bounds.w * 0.25, v.w * factor));
      const nh = nw * (v.h / v.w);
      // Zoom toward centre of current view.
      return { x: v.x + (v.w - nw) / 2, y: v.y + (v.h - nh) / 2, w: nw, h: nh };
    });
  }, [bounds.w, bounds.h]);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.current.x) / rect.width) * vb.w;
    const dy = ((e.clientY - drag.current.y) / rect.height) * vb.h;
    drag.current = { x: e.clientX, y: e.clientY };
    setVb((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
  };
  const onUp = () => { drag.current = null; };

  return (
    <div className="map-canvas-wrap">
      <svg
        ref={svgRef}
        className="map-canvas"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        role="img"
        aria-label="Knowledge graph. Switch to List view for a keyboard-navigable equivalent."
      >
        {/* Region labels behind everything */}
        {slice.regions.map((r) => (
          <text key={r.id} x={r.labelX} y={r.labelY} className="map-region-label" textAnchor="middle">
            {r.name}
          </text>
        ))}
        {/* Edges */}
        {slice.edges.map((e, i) => {
          const a = nodeById.get(e.fromId), b = nodeById.get(e.toId);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              className={`map-edge ek-${e.kind.toLowerCase()}`}
            />
          );
        })}
        {/* Nodes */}
        {slice.nodes.map((n) => (
          <g key={n.id} className="map-node-g" onClick={() => onSelect(n.slug)}>
            <circle
              cx={n.x} cy={n.y} r={n.state === "held" ? 13 : 10}
              className={`map-node st-${n.state}${selected === n.slug ? " sel" : ""}`}
            />
            <text x={n.x} y={n.y - 18} className="map-node-label" textAnchor="middle">
              {n.title.length > 26 ? n.title.slice(0, 25) + "…" : n.title}
            </text>
          </g>
        ))}
      </svg>
      <p className="map-hint">Scroll to zoom · drag to pan · click a node</p>
    </div>
  );
}

// ─── List view (accessibility equivalent, release-blocking) ──────────────────

function ListView({
  slice,
  nodeById,
  onSelect,
}: {
  slice: GraphSlice;
  nodeById: Map<string, SliceNode>;
  onSelect: (slug: string) => void;
}) {
  const order: SliceNode["state"][] = ["frontier", "held", "thin", "mapped", "unmapped"];
  const byState = useMemo(() => {
    const m = new Map<SliceNode["state"], SliceNode[]>();
    for (const s of order) m.set(s, []);
    for (const n of slice.nodes) m.get(n.state)!.push(n);
    return m;
  }, [slice.nodes]);

  return (
    <div className="map-list">
      {order.map((st) => {
        const nodes = byState.get(st)!;
        if (nodes.length === 0) return null;
        return (
          <section key={st} className="map-list-group" aria-label={STATE_LABEL[st]}>
            <div className="sec-head" style={{ margin: "18px 0 10px" }}>
              <span className="kick">{STATE_LABEL[st]}</span>
              <div className="sec-line" />
              <span className="map-phase-tag">{nodes.length}</span>
            </div>
            <ul className="map-list-items">
              {nodes.map((n) => (
                <li key={n.id}>
                  <button className={`map-list-item st-${n.state}`} onClick={() => onSelect(n.slug)}>
                    <span className={`legend-dot st-${n.state}`} />
                    <span className="mli-title">{n.title}</span>
                    <span className="mli-sum">{n.summary}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="map-hint" style={{ marginTop: 14 }}>
        This list is the full equivalent of the map — every node, grouped by your relation to it. Open
        one to read it and step to adjacent nodes.
      </p>
      <span className="visually-hidden">{nodeById.size} nodes total.</span>
    </div>
  );
}

// ─── Node panel (shared by both views) ───────────────────────────────────────

function NodePanel({
  slug,
  isAuthed,
  neighbourSlugs,
  onClose,
  onNavigate,
}: {
  slug: string;
  isAuthed: boolean;
  neighbourSlugs: SliceNode[];
  onClose: () => void;
  onNavigate: (slug: string) => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [newClaim, setNewClaim] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nodes/${slug}`);
      setDetail(res.ok ? await res.json() : null);
    } catch {
      setDetail(null);
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  async function takeStance(claimId: string, stance: "FOR" | "AGAINST") {
    if (!isAuthed) return;
    setBusy(true);
    await fetch(`/api/claims/${claimId}/positions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stance }),
    });
    await load();
    router.refresh();
    setBusy(false);
  }

  async function openClaim() {
    if (!isAuthed || !newClaim.trim() || !detail) return;
    setBusy(true);
    await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId: detail.id, text: newClaim.trim() }),
    });
    setNewClaim("");
    await load();
    setBusy(false);
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Node">
        <div className="drawer-head">
          <button className="drawer-close" onClick={onClose} aria-label="Close">✕</button>
          {loading || !detail ? (
            <h3>{loading ? "Loading…" : "Not found"}</h3>
          ) : (
            <>
              <div className="code">
                {detail.region?.name ?? "—"} · {detail.kind.toLowerCase()}
                {detail.holdingState && <span className={`hold-badge ${detail.holdingState}`}>{detail.holdingState}</span>}
              </div>
              <h3>{detail.title}</h3>
              <div className="meta">
                <span className="pill">
                  {detail.presence.count} {detail.presence.count === 1 ? "person holds this" : "people hold this"}
                  {detail.presence.names.length > 0 && ` · ${detail.presence.names.join(", ")}`}
                </span>
              </div>
            </>
          )}
        </div>

        {detail && (
          <div className="drawer-body">
            <p style={{ color: "var(--fg)", fontSize: 15, lineHeight: 1.55, marginBottom: 18 }}>{detail.summary}</p>

            {/* Edge traversal — adjacent nodes as keyboard-reachable links */}
            {neighbourSlugs.length > 0 && (
              <>
                <div className="sec-head" style={{ margin: "8px 0 10px" }}>
                  <span className="kick">Adjacent</span>
                  <div className="sec-line" />
                </div>
                <div className="chips">
                  {neighbourSlugs.map((n) => (
                    <button key={n.id} className={`chip st-${n.state}`} onClick={() => onNavigate(n.slug)}>
                      {n.title}
                    </button>
                  ))}
                </div>
              </>
            )}

            {detail.references.length > 0 && (
              <>
                <div className="sec-head" style={{ margin: "22px 0 10px" }}>
                  <span className="kick">References</span>
                  <div className="sec-line" />
                </div>
                <p className="phelp" style={{ marginTop: 0 }}>Carried from The List — reference, not a prerequisite.</p>
                <div className="reslist">
                  {detail.references.map((r) => (
                    <div key={r.id} className="resitem">
                      <div className="res-main">
                        <div className="res-title">
                          {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title} ↗</a> : r.title}
                        </div>
                        <div className="res-meta">
                          <span className={`rtype ${r.kind}`}>{r.kind}</span>
                          {r.author && <span>{r.author}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Claims — the multi-user argument layer */}
            <div className="sec-head" style={{ margin: "22px 0 10px" }}>
              <span className="kick">Open claims</span>
              <div className="sec-line" />
            </div>
            <p className="phelp" style={{ marginTop: 0 }}>Unsettled propositions. The platform never resolves them.</p>
            {detail.claims.length === 0 && <p style={{ color: "var(--fg-mute)", fontSize: 13.5 }}>No claims yet.</p>}
            <div className="claimlist">
              {detail.claims.map((c) => (
                <div key={c.id} className="claim">
                  <div className="claim-text">{c.text}</div>
                  <div className="claim-actions">
                    <button
                      className={`btn btn-sm ${c.myStance === "FOR" ? "btn-iris" : "btn-ghost"}`}
                      disabled={!isAuthed || busy}
                      onClick={() => takeStance(c.id, "FOR")}
                    >
                      For · {c.for}
                    </button>
                    <button
                      className={`btn btn-sm ${c.myStance === "AGAINST" ? "btn-iris" : "btn-ghost"}`}
                      disabled={!isAuthed || busy}
                      onClick={() => takeStance(c.id, "AGAINST")}
                    >
                      Against · {c.against}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {isAuthed ? (
              <div className="field" style={{ marginTop: 12 }}>
                <input
                  className="input"
                  placeholder="Open a new claim on this node…"
                  value={newClaim}
                  onChange={(e) => setNewClaim(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && openClaim()}
                />
                <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={busy || !newClaim.trim()} onClick={openClaim}>
                  Open claim
                </button>
              </div>
            ) : (
              <p style={{ color: "var(--fg-mute)", fontSize: 13, marginTop: 10 }}>
                <a href="/register" style={{ color: "var(--amber)" }}>Create an account</a> to take a position or open a claim.
              </p>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
