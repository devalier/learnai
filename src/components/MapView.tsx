"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
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
  whatItMeans: string;
  commonlyWrong: string;
  howToDefend: string;
  coverage: {
    id: string;
    depth: "DEFINES" | "DEMONSTRATES" | "MENTIONS";
    evidence: string;
    startSec: number | null;
    source: string;
    confidence: number | null;
    resource: { id: string; title: string; url: string; kind: string; author: string; moduleTitle: string };
  }[];
  claims: { id: string; text: string; for: number; against: number; myStance: "FOR" | "AGAINST" | null }[];
  presence: { count: number; names: string[] };
  holdingState: "held" | "thin" | null;
};

const Graph3D = dynamic(() => import("./Graph3D"), {
  ssr: false,
  loading: () => <p className="map-hint">Loading map…</p>,
});

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
        <Graph3D slice={slice} onSelect={setSelected} selected={selected} />
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

            {/* The three-part body. This is what makes a holding defensible:
                you cannot say "I hold my ground here" without knowing what the
                thing means, what people get wrong, and what your argument is. */}
            {(detail.whatItMeans || detail.commonlyWrong || detail.howToDefend) && (
              <div className="nodebody">
                {detail.whatItMeans && (
                  <div className="nb-part">
                    <span className="nb-label">What it means</span>
                    <p>{detail.whatItMeans}</p>
                  </div>
                )}
                {detail.commonlyWrong && (
                  <div className="nb-part nb-wrong">
                    <span className="nb-label">What people get wrong</span>
                    <p>{detail.commonlyWrong}</p>
                  </div>
                )}
                {detail.howToDefend && (
                  <div className="nb-part nb-defend">
                    <span className="nb-label">How you hold your ground</span>
                    <p>{detail.howToDefend}</p>
                  </div>
                )}
              </div>
            )}

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

            {detail.coverage.length > 0 && (
              <>
                <div className="sec-head" style={{ margin: "22px 0 10px" }}>
                  <span className="kick">Where it is covered</span>
                  <div className="sec-line" />
                </div>
                <p className="phelp" style={{ marginTop: 0 }}>
                  Depth, not a reading list. Only <b>defines</b> and <b>demonstrates</b> put ground
                  under you — a passing mention never does.
                </p>
                <div className="reslist">
                  {detail.coverage.map((c) => {
                    // Deep-link straight to the evidence when we know where it is.
                    const href =
                      c.startSec != null && c.resource.url.includes("youtube.com/watch")
                        ? `${c.resource.url}&t=${c.startSec}`
                        : c.resource.url;
                    return (
                      <div key={c.id} className={`resitem cov-${c.depth.toLowerCase()}`}>
                        <div className="res-main">
                          <div className="res-title">
                            {href ? (
                              <a href={href} target="_blank" rel="noopener noreferrer">
                                {c.resource.title} ↗
                              </a>
                            ) : (
                              c.resource.title
                            )}
                          </div>
                          {c.evidence && <div className="cov-evidence">{c.evidence}</div>}
                          <div className="res-meta">
                            <span className={`covdepth ${c.depth}`}>{c.depth.toLowerCase()}</span>
                            <span className={`rtype ${c.resource.kind}`}>{c.resource.kind}</span>
                            {c.resource.author && <span>{c.resource.author}</span>}
                            {c.startSec != null && <span>from {Math.floor(c.startSec / 60)}:{String(c.startSec % 60).padStart(2, "0")}</span>}
                            {c.source !== "HUMAN" && c.confidence != null && c.confidence < 0.75 && (
                              <span title="Depth inferred, not yet confirmed against the resource">unconfirmed</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
