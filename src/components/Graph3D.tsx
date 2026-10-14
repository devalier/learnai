"use client";

/**
 * 3D clustered knowledge graph.
 *
 * Approach follows the-palindrome/ml-knowledge-graph (MIT): three.js scene,
 * regions placed on a large sphere via a golden spiral, each region's nodes on
 * a smaller golden-spiral sphere around its centroid, instanced node meshes,
 * orbit controls, click-to-focus with the neighbourhood highlighted.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GraphSlice, SliceNode } from "@/lib/graph";
import StateGlyph, { AMBER, FRONTIER_RING, STATE_LOOK, STATE_META, STATE_ORDER } from "./StateGlyph";

const GOLDEN = Math.PI * (1 + Math.sqrt(5));
const BG = 0x0b0d12;

function spiral(i: number, n: number, r: number, c = new THREE.Vector3()): THREE.Vector3 {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
  const th = GOLDEN * i;
  return new THREE.Vector3(
    c.x + r * Math.sin(phi) * Math.cos(th),
    c.y + r * Math.sin(phi) * Math.sin(th),
    c.z + r * Math.cos(phi)
  );
}

const STATE_STYLE = STATE_LOOK;

function regionLabel(text: string, color: THREE.Color): THREE.Sprite {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = "600 44px system-ui, sans-serif";
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text.toUpperCase()).width) + 20;
  c.width = w;
  c.height = 72;
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#" + color.getHexString();
  ctx.fillText(text.toUpperCase(), 10, 38);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
  const s = new THREE.Sprite(mat);
  s.scale.set((w / 72) * 14, 14, 1);
  s.renderOrder = 2;
  return s;
}

export default function Graph3D({
  slice,
  selected,
  onSelect,
}: {
  slice: GraphSlice;
  selected: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  const apiRef = useRef<{ focus: (slug: string | null) => void; highlightRegion: (id: string | null) => void; exitRadial: () => void } | null>(null);
  const [radial, setRadial] = useState(false);
  const [region, setRegion] = useState<string | null>(null);
  const [webgl, setWebgl] = useState(true);

  onSelectRef.current = onSelect;

  const regions = slice.regions;
  const regionHue = (id: string | null) => {
    const idx = Math.max(0, regions.findIndex((r) => r.id === id));
    return id == null ? 0.6 : (idx * 0.618034) % 1;
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      setWebgl(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(BG);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(BG, 0.0011);
    const camera = new THREE.PerspectiveCamera(60, 1, 1, 6000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 40;
    controls.maxDistance = 1800;
    controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotateSpeed = 0.25;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x101321, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(180, 220, 160);
    scene.add(key);

    // ── Layout ────────────────────────────────────────────────────────────
    const nodes = slice.nodes;
    const groups = new Map<string | null, SliceNode[]>();
    for (const n of nodes) {
      const k = n.regionId;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(n);
    }
    const keys = [...groups.keys()];
    const sphereR = keys.length > 1 ? 70 + Math.sqrt(nodes.length) * 12 : 0;
    const centroids = new Map<string | null, THREE.Vector3>();
    keys.forEach((k, i) => centroids.set(k, keys.length > 1 ? spiral(i, keys.length, sphereR) : new THREE.Vector3()));
    const pos = new Map<string, THREE.Vector3>();
    for (const [k, g] of groups) {
      const r = Math.max(14, Math.sqrt(g.length) * 11);
      g.forEach((n, i) => pos.set(n.id, g.length === 1 ? centroids.get(k)!.clone() : spiral(i, g.length, r, centroids.get(k)!)));
    }

    // Current positions (animated between the cluster layout and a radial one).
    const P: THREE.Vector3[] = nodes.map((n) => pos.get(n.id)!.clone());
    const clusterPos: THREE.Vector3[] = P.map((v) => v.clone());

    const hueOf = (id: string | null) => regionHue(id);
    const baseColor = (n: SliceNode) => {
      const st = STATE_STYLE[n.state];
      return new THREE.Color().setHSL(hueOf(n.regionId), st.sat, st.light);
    };

    // ── Nodes ─────────────────────────────────────────────────────────────
    const R = 4.2;
    const mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(R, 24, 16),
      new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05 }),
      nodes.length
    );
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    const indexOfId = new Map(nodes.map((n, i) => [n.id, i]));
    const idxBySlug = new Map(nodes.map((n, i) => [n.slug, i]));
    const bases = nodes.map(baseColor);
    const targetScale = new Float32Array(nodes.length);
    const curScale = new Float32Array(nodes.length);
    const targetDim = new Float32Array(nodes.length).fill(1); // colour multiplier
    const curDim = new Float32Array(nodes.length).fill(1);
    nodes.forEach((n, i) => { targetScale[i] = curScale[i] = STATE_STYLE[n.state].scale; });

    // Ring sprites: a ring says "this is yours / this is next", never the colour.
    const ringTexture = (width: number, dash: number[]) => {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const x = c.getContext("2d")!;
      x.strokeStyle = "#fff";
      x.lineWidth = width;
      x.setLineDash(dash);
      x.beginPath();
      x.arc(64, 64, 54, 0, Math.PI * 2);
      x.stroke();
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const texSolid = ringTexture(5, []);
    const texThick = ringTexture(9, []);
    const texDash = ringTexture(5, [13, 10]);
    type NodeRing = { sprite: THREE.Sprite; i: number; kind: "held" | "staked" | "thin" | "frontier"; base: number; mult: number };
    const rings: NodeRing[] = [];
    const addRing = (i: number, kind: NodeRing["kind"], tex: THREE.Texture, color: string, base: number, mult: number) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(color), transparent: true, depthWrite: false, opacity: base }));
      sprite.position.copy(P[i]);
      scene.add(sprite);
      rings.push({ sprite, i, kind, base, mult });
    };
    nodes.forEach((n, i) => {
      if (n.state === "held") {
        addRing(i, "held", texSolid, AMBER, 0.95, 2.5);
        if (n.staked) addRing(i, "staked", texSolid, AMBER, 0.7, 3.3);
      } else if (n.state === "thin") addRing(i, "thin", texDash, AMBER, 0.6, 2.5);
      else if (n.state === "frontier") addRing(i, "frontier", texDash, FRONTIER_RING, 0.95, 2.6);
    });
    // One white ring per selected node (a pool, grown on demand).
    const selRings: THREE.Sprite[] = [];
    const ringFor = (k: number) => {
      while (selRings.length <= k) {
        const r = new THREE.Sprite(new THREE.SpriteMaterial({ map: texThick, color: 0xffffff, transparent: true, depthWrite: false, depthTest: false }));
        r.visible = false;
        r.renderOrder = 5;
        scene.add(r);
        selRings.push(r);
      }
      return selRings[k];
    };

    // ── Edges ─────────────────────────────────────────────────────────────
    const edgeList = slice.edges.filter((e) => indexOfId.has(e.fromId) && indexOfId.has(e.toId));
    const segPos = new Float32Array(edgeList.length * 6);
    const segCol = new Float32Array(edgeList.length * 6);
    const edgeBase: THREE.Color[] = [];
    const eA = edgeList.map((e) => indexOfId.get(e.fromId)!);
    const eB = edgeList.map((e) => indexOfId.get(e.toId)!);
    edgeList.forEach((e, k) => {
      const a = P[eA[k]], b = P[eB[k]];
      segPos.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 6);
      const c = e.kind === "TENSION" ? new THREE.Color(0xff6b7a)
        : e.kind === "REFINES" ? new THREE.Color(0x8aa0ff)
        : new THREE.Color(0x5b6478);
      edgeBase.push(c);
    });
    const edgeGeo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(segPos, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    edgeGeo.setAttribute("position", posAttr);
    const colAttr = new THREE.BufferAttribute(segCol, 3);
    edgeGeo.setAttribute("color", colAttr);
    const edgeMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false });
    const lines = new THREE.LineSegments(edgeGeo, edgeMat);
    lines.frustumCulled = false; // endpoints move during layout changes
    mesh.frustumCulled = false;
    scene.add(lines);

    // ── Region labels ─────────────────────────────────────────────────────
    const labels: THREE.Sprite[] = [];
    for (const r of regions) {
      const g = groups.get(r.id);
      if (!g) continue;
      const col = new THREE.Color().setHSL(hueOf(r.id), 0.7, 0.75);
      const s = regionLabel(r.name, col);
      const c = centroids.get(r.id)!;
      const out = c.clone().normalize();
      s.position.copy(c).addScaledVector(keys.length > 1 ? out : new THREE.Vector3(0, 1, 0), Math.max(14, Math.sqrt(g.length) * 11) + 14);
      scene.add(s);
      labels.push(s);
    }

    // ── State application ────────────────────────────────────────────────
    const nbrs = new Map<number, Set<number>>();
    edgeList.forEach((e) => {
      const a = indexOfId.get(e.fromId)!, b = indexOfId.get(e.toId)!;
      (nbrs.get(a) ?? nbrs.set(a, new Set()).get(a)!).add(b);
      (nbrs.get(b) ?? nbrs.set(b, new Set()).get(b)!).add(a);
    });

    // The selection: one node (click) or a group (shift+click). Everything not in
    // it, and not next to it, is dimmed.
    const sel = new Set<number>();
    let regionFocus: string | null = null;
    let hoverIdx: number | null = null;
    let mode: "cluster" | "radial" = "cluster";

    function publish() {
      labels.forEach((l) => { l.visible = mode === "cluster"; }); // clusters dissolve in radial view
      host!.dataset.mode = mode;
      host!.dataset.selection = [...sel].map((i) => nodes[i].slug).join(",");
    }

    function applyFocus() {
      const near = new Set<number>(sel);
      for (const i of sel) for (const j of nbrs.get(i) ?? []) near.add(j);
      const live = (i: number) => (regionFocus == null || nodes[i].regionId === regionFocus) && (sel.size === 0 || near.has(i));
      nodes.forEach((n, i) => {
        targetDim[i] = live(i) ? 1 : 0.16;
        targetScale[i] = STATE_STYLE[n.state].scale * (sel.has(i) ? 1.5 : 1);
      });
      edgeList.forEach((_, k) => {
        const a = eA[k], b = eB[k];
        let w: number;
        if (sel.size) w = sel.has(a) || sel.has(b) ? 1.0 : 0.05;
        else if (regionFocus != null) w = live(a) && live(b) ? 0.55 : 0.04;
        else w = 0.4;
        // Premultiplied against the background: lines fade by darkening, which
        // keeps them cheap (no per-segment alpha) and fog-compatible.
        const col = new THREE.Color(BG).lerp(edgeBase[k], w);
        segCol.set([col.r, col.g, col.b, col.r, col.g, col.b], k * 6);
      });
      colAttr.needsUpdate = true;
      placeRings();
      publish();
    }

    function placeRings() {
      let k = 0;
      for (const i of sel) {
        const r = ringFor(k++);
        r.visible = true;
        r.position.copy(P[i]);
        r.scale.setScalar(R * targetScale[i] * 3.6);
      }
      for (; k < selRings.length; k++) selRings[k].visible = false;
    }

    // Layout animation (cluster <-> radial). Edges, halos and rings follow the nodes.
    let anim: { t: number; from: THREE.Vector3[]; to: THREE.Vector3[] } | null = null;
    let needsBounds = true;
    function syncGeometry() {
      for (let k = 0; k < eA.length; k++) {
        const a = P[eA[k]], b = P[eB[k]];
        segPos[k * 6] = a.x; segPos[k * 6 + 1] = a.y; segPos[k * 6 + 2] = a.z;
        segPos[k * 6 + 3] = b.x; segPos[k * 6 + 4] = b.y; segPos[k * 6 + 5] = b.z;
      }
      posAttr.needsUpdate = true;
      rings.forEach((r) => r.sprite.position.copy(P[r.i]));
      placeRings();
      needsBounds = true; // picking uses the instanced mesh's bounding sphere
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function moveTo(target: THREE.Vector3[]) {
      if (reduce) { target.forEach((v, i) => P[i].copy(v)); anim = null; syncGeometry(); return; }
      anim = { t: 0, from: P.map((v) => v.clone()), to: target };
    }

    // Camera tween
    let tween: { t: number; fromP: THREE.Vector3; toP: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3 } | null = null;
    function flyTo(target: THREE.Vector3, dist: number) {
      const dir = camera.position.clone().sub(controls.target).normalize();
      const toP = target.clone().addScaledVector(dir, dist);
      if (reduce) { controls.target.copy(target); camera.position.copy(toP); return; }
      tween = { t: 0, fromP: camera.position.clone(), toP, fromT: controls.target.clone(), toT: target.clone() };
    }
    function flyToSelection() {
      if (sel.size === 0) return;
      const c = new THREE.Vector3();
      for (const i of sel) c.add(P[i]);
      c.divideScalar(sel.size);
      let rad = 0;
      for (const i of sel) rad = Math.max(rad, P[i].distanceTo(c));
      controls.autoRotate = false;
      flyTo(c, sel.size === 1 ? 170 : Math.max(170, rad * 2.6 + 80));
    }

    // Initial framing
    const box = new THREE.Box3();
    P.forEach((p) => box.expandByPoint(p));
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const homeDist = Math.max(120, sphere.radius * 1.7);
    controls.target.copy(sphere.center);
    camera.position.copy(sphere.center).add(new THREE.Vector3(0.25, 0.35, 1).normalize().multiplyScalar(homeDist));
    controls.maxDistance = homeDist * 3;

    // Radial (ego-centric) layout: the chosen node at the centre, everything else on
    // rings by how many hops away it is. Unreachable nodes go on the outermost ring.
    const RING = 48;
    function radialLayout(center: number): { pts: THREE.Vector3[]; outer: number } {
      const dist = new Array<number>(nodes.length).fill(-1);
      dist[center] = 0;
      const queue = [center];
      for (let h = 0; h < queue.length; h++) {
        for (const j of nbrs.get(queue[h]) ?? []) if (dist[j] < 0) { dist[j] = dist[queue[h]] + 1; queue.push(j); }
      }
      const maxHop = Math.max(...dist);
      const out = Math.max(maxHop, 0) + 1;
      const rings = new Map<number, number[]>();
      dist.forEach((d, i) => {
        if (i === center) return;
        const r = d < 0 ? out : d;
        (rings.get(r) ?? rings.set(r, []).get(r)!).push(i);
      });
      const pts = nodes.map(() => sphere.center.clone());
      for (const [r, list] of rings) list.forEach((i, k) => pts[i].copy(spiral(k, list.length, r * RING, sphere.center)));
      return { pts, outer: (rings.size ? Math.max(...rings.keys()) : 1) * RING };
    }
    function enterRadial(i: number) {
      const { pts, outer } = radialLayout(i);
      mode = "radial";
      setRadial(true);
      sel.clear();
      sel.add(i);
      moveTo(pts);
      applyFocus();
      controls.autoRotate = false;
      flyTo(sphere.center, Math.max(160, outer * 2.2));
    }
    function exitRadial() {
      if (mode !== "radial") return;
      mode = "cluster";
      setRadial(false);
      sel.clear();
      moveTo(clusterPos);
      applyFocus();
      flyTo(sphere.center, homeDist);
      onSelectRef.current(null);
    }

    apiRef.current = {
      focus(slug) {
        const idx = slug == null ? null : idxBySlug.get(slug) ?? null;
        if (idx == null) {
          if (sel.size) { sel.clear(); applyFocus(); }
          return;
        }
        if (sel.size === 1 && sel.has(idx)) return; // already focused (e.g. by this click)
        sel.clear();
        sel.add(idx);
        applyFocus();
        flyToSelection();
      },
      highlightRegion(id) {
        regionFocus = id;
        applyFocus();
      },
      exitRadial,
    };
    applyFocus();
    if (selectedRef.current) apiRef.current.focus(selectedRef.current);

    // ── Interaction ───────────────────────────────────────────────────────
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function pick(ev: MouseEvent): number | null {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObject(mesh, false);
      // Dimmed nodes (outside the selection) stay clickable: that is how you extend a
      // group or walk outward in radial view. Only a region filter hides nodes from picking.
      for (const h of hits) {
        if (h.instanceId != null && (regionFocus == null || nodes[h.instanceId].regionId === regionFocus)) return h.instanceId;
      }
      return null;
    }
    let down = { x: 0, y: 0 };
    let clickTimer: ReturnType<typeof setTimeout> | null = null;
    const el = renderer.domElement;
    const dragged = (e: MouseEvent) => (e.clientX - down.x) ** 2 + (e.clientY - down.y) ** 2 > 25;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; controls.autoRotate = false; };

    // A click waits 250 ms so a double-click can cancel it (otherwise the first
    // click of a double-click would open the node panel and cover the graph).
    function handleClick(i: number | null, shift: boolean) {
      if (shift) {
        if (i == null) return; // shift+click on empty space keeps the group
        if (sel.has(i)) sel.delete(i); else sel.add(i);
        applyFocus();
        flyToSelection();
        return;
      }
      if (i == null) {
        sel.clear();
        applyFocus();
        onSelectRef.current(null);
        return;
      }
      sel.clear();
      sel.add(i);
      applyFocus();
      flyToSelection();
      onSelectRef.current(nodes[i].slug);
    }
    const onClick = (e: MouseEvent) => {
      if (dragged(e)) return;
      const i = pick(e), shift = e.shiftKey;
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => { clickTimer = null; handleClick(i, shift); }, 250);
    };
    const onDbl = (e: MouseEvent) => {
      if (dragged(e)) return;
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
      const i = pick(e);
      if (i == null) exitRadial();
      else enterRadial(i);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (mode === "radial") exitRadial();
      else if (sel.size) { sel.clear(); applyFocus(); onSelectRef.current(null); }
    };
    let lastMove = 0;
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return;
      const now = performance.now();
      if (now - lastMove < 30) return;
      lastMove = now;
      const i = pick(e);
      hoverIdx = i;
      el.style.cursor = i == null ? "grab" : "pointer";
      const tip = tipRef.current;
      if (!tip) return;
      if (i == null) { tip.style.opacity = "0"; return; }
      const r = host!.getBoundingClientRect();
      tip.textContent = nodes[i].title;
      tip.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 14}px)`;
      tip.style.opacity = "1";
    };
    const onLeave = () => { hoverIdx = null; if (tipRef.current) tipRef.current.style.opacity = "0"; };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("click", onClick);
    el.addEventListener("dblclick", onDbl);
    window.addEventListener("keydown", onKey);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    // ── Loop ──────────────────────────────────────────────────────────────
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const tmpC = new THREE.Color();
    const bgC = new THREE.Color(BG);
    function resize() {
      const w = host!.clientWidth, h = host!.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const debug = new URLSearchParams(window.location.search).has("g3d_debug");
    let raf = 0;
    let tick = 0;
    let last = performance.now();
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (tween) {
        tween.t = Math.min(1, tween.t + dt / 0.9);
        const k = 1 - Math.pow(1 - tween.t, 3);
        camera.position.lerpVectors(tween.fromP, tween.toP, k);
        controls.target.lerpVectors(tween.fromT, tween.toT, k);
        if (tween.t >= 1) tween = null;
      }
      if (anim) {
        anim.t = Math.min(1, anim.t + dt / 0.9);
        const k = 1 - Math.pow(1 - anim.t, 3);
        for (let i = 0; i < nodes.length; i++) P[i].lerpVectors(anim.from[i], anim.to[i], k);
        syncGeometry();
        if (anim.t >= 1) anim = null;
      }
      const ease = 1 - Math.exp(-dt * 10);
      for (let i = 0; i < nodes.length; i++) {
        curScale[i] += (targetScale[i] * (i === hoverIdx ? 1.25 : 1) - curScale[i]) * ease;
        curDim[i] += (targetDim[i] - curDim[i]) * ease;
        sc.setScalar(curScale[i]);
        m4.compose(P[i], q, sc);
        mesh.setMatrixAt(i, m4);
        tmpC.copy(bases[i]);
        tmpC.lerp(bgC, 1 - curDim[i]);
        mesh.setColorAt(i, tmpC);
      }
      const ts = now / 1000;
      for (const r of rings) {
        const live = curDim[r.i];
        const pulse = r.kind === "frontier" && !reduce ? 1 + 0.1 * Math.sin(ts * 2.4 + r.i) : 1;
        r.sprite.scale.setScalar(R * curScale[r.i] * r.mult * pulse);
        (r.sprite.material as THREE.SpriteMaterial).opacity = r.base * (0.18 + 0.82 * live) * (r.kind === "frontier" && !reduce ? 0.8 + 0.2 * Math.sin(ts * 2.4 + r.i) : 1);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (needsBounds) { mesh.computeBoundingSphere(); needsBounds = false; }
      controls.update();
      if (++tick % 6 === 0) {
        const c = camera.position, t = controls.target;
        host!.dataset.cam = [c.x, c.y, c.z, t.x, t.y, t.z].map((v) => v.toFixed(1)).join(",");
        if (debug) {
          // Read-only: where each node is on screen, so a browser test can click on real nodes.
          const rect = host!.getBoundingClientRect();
          const v = new THREE.Vector3();
          host!.dataset.screen = JSON.stringify(
            nodes.map((n, i) => { v.copy(P[i]).project(camera); return [n.slug, Math.round(((v.x + 1) / 2) * rect.width), Math.round(((1 - v.y) / 2) * rect.height)]; })
          );
        }
      }
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("click", onClick);
      el.removeEventListener("dblclick", onDbl);
      window.removeEventListener("keydown", onKey);
      if (clickTimer) clearTimeout(clickTimer);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
          (x as THREE.SpriteMaterial).map?.dispose?.();
          x.dispose();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
      apiRef.current = null;
    };
    // The scene is rebuilt only when the data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slice]);

  useEffect(() => {
    selectedRef.current = selected;
    apiRef.current?.focus(selected);
  }, [selected]);

  useEffect(() => {
    apiRef.current?.highlightRegion(region);
  }, [region]);

  if (!webgl) {
    return <p className="map-hint">3D view needs WebGL, which isn&rsquo;t available here. Use the List view.</p>;
  }

  return (
    <div className="map-canvas-wrap g3d">
      <div ref={hostRef} className="g3d-host" role="img" aria-label="3D knowledge graph. Rotate: drag. Zoom: scroll. Pan: right-drag. Click: focus selection. Shift+Click: toggle selection. Double-click: radial view. Switch to List view for a keyboard-navigable equivalent." />
      <div ref={tipRef} className="g3d-tip" aria-hidden="true" />
      {regions.length > 0 && (
        <div className="g3d-regions" role="group" aria-label="Highlight a region">
          {regions.map((r) => (
            <button
              key={r.id}
              className={region === r.id ? "on" : ""}
              aria-pressed={region === r.id}
              onClick={() => setRegion(region === r.id ? null : r.id)}
            >
              <i style={{ background: `hsl(${Math.round(regionHue(r.id) * 360)} 70% 62%)` }} />
              {r.name}
            </button>
          ))}
        </div>
      )}
      <div className="g3d-legend" role="group" aria-label="What the symbols mean">
        <div className="g3d-legend-title">Colour is the domain. Rings and size are your position.</div>
        {[...STATE_ORDER].map((st) => (
          <div key={st} className="g3d-legend-row">
            <StateGlyph state={st} size={22} />
            <span><b>{STATE_META[st].label}</b><i>{STATE_META[st].desc}</i></span>
          </div>
        ))}
        <div className="g3d-legend-row">
          <StateGlyph state="held" staked size={22} />
          <span><b>Staked</b><i>Held, and you claimed expertise. It never thins.</i></span>
        </div>
      </div>
      <div className="g3d-help" aria-hidden="true">
        <span>Rotate: drag · Zoom: scroll · Pan: right-drag</span>
        <span>Click: focus selection · Shift+Click: toggle selection · Double-click: radial view</span>
      </div>
      {radial && (
        <div className="g3d-radial">
          <span>Radial view</span>
          <button onClick={() => apiRef.current?.exitRadial()}>Exit (Esc)</button>
        </div>
      )}
    </div>
  );
}
