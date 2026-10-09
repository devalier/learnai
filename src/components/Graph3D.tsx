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

const STATE_STYLE: Record<SliceNode["state"], { scale: number; light: number; sat: number; alpha: number }> = {
  held: { scale: 1.9, light: 0.66, sat: 0.9, alpha: 1 },
  frontier: { scale: 1.5, light: 0.78, sat: 0.9, alpha: 1 },
  thin: { scale: 1.2, light: 0.55, sat: 0.6, alpha: 0.65 },
  mapped: { scale: 1.1, light: 0.5, sat: 0.55, alpha: 0.9 },
  unmapped: { scale: 0.9, light: 0.38, sat: 0.35, alpha: 0.8 },
};

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
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.6, depthWrite: false, fog: false });
  const s = new THREE.Sprite(mat);
  s.scale.set((w / 72) * 20, 20, 1);
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
  const apiRef = useRef<{ focus: (slug: string | null) => void; highlightRegion: (id: string | null) => void } | null>(null);
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

    // Frontier / selection halo rings (billboarded sprites).
    const ringCanvas = document.createElement("canvas");
    ringCanvas.width = ringCanvas.height = 128;
    const rc = ringCanvas.getContext("2d")!;
    rc.strokeStyle = "#fff";
    rc.lineWidth = 4;
    rc.setLineDash([14, 10]);
    rc.beginPath();
    rc.arc(64, 64, 54, 0, Math.PI * 2);
    rc.stroke();
    const ringTex = new THREE.CanvasTexture(ringCanvas);
    const halos: THREE.Sprite[] = [];
    nodes.forEach((n, i) => {
      if (n.state !== "frontier") return;
      const m = new THREE.SpriteMaterial({ map: ringTex, color: 0x8aa0ff, transparent: true, depthWrite: false, fog: true });
      const s = new THREE.Sprite(m);
      s.position.copy(pos.get(n.id)!);
      s.scale.setScalar(R * STATE_STYLE.frontier.scale * 2.9);
      s.userData.i = i;
      scene.add(s);
      halos.push(s);
    });
    const selRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: 0xffffff, transparent: true, depthWrite: false, depthTest: false }));
    selRing.visible = false;
    selRing.renderOrder = 5;
    scene.add(selRing);

    // ── Edges ─────────────────────────────────────────────────────────────
    const edgeList = slice.edges.filter((e) => indexOfId.has(e.fromId) && indexOfId.has(e.toId));
    const segPos = new Float32Array(edgeList.length * 6);
    const segCol = new Float32Array(edgeList.length * 6);
    const edgeBase: THREE.Color[] = [];
    edgeList.forEach((e, k) => {
      const a = pos.get(e.fromId)!, b = pos.get(e.toId)!;
      segPos.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 6);
      const c = e.kind === "TENSION" ? new THREE.Color(0xff6b7a)
        : e.kind === "REFINES" ? new THREE.Color(0x8aa0ff)
        : new THREE.Color(0x5b6478);
      edgeBase.push(c);
    });
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute("position", new THREE.BufferAttribute(segPos, 3));
    const colAttr = new THREE.BufferAttribute(segCol, 3);
    edgeGeo.setAttribute("color", colAttr);
    const edgeMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false });
    const lines = new THREE.LineSegments(edgeGeo, edgeMat);
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

    let focusIdx: number | null = null;
    let regionFocus: string | null = null;
    let hoverIdx: number | null = null;

    function applyFocus() {
      const live = (i: number) =>
        (regionFocus == null || nodes[i].regionId === regionFocus) &&
        (focusIdx == null || i === focusIdx || nbrs.get(focusIdx)?.has(i));
      nodes.forEach((n, i) => {
        targetDim[i] = live(i) ? 1 : 0.16;
        targetScale[i] = STATE_STYLE[n.state].scale * (i === focusIdx ? 1.5 : 1);
      });
      edgeList.forEach((e, k) => {
        const a = indexOfId.get(e.fromId)!, b = indexOfId.get(e.toId)!;
        let w: number;
        if (focusIdx != null) w = a === focusIdx || b === focusIdx ? 1.0 : 0.05;
        else if (regionFocus != null) w = live(a) && live(b) ? 0.55 : 0.04;
        else w = 0.4;
        const c = edgeBase[k];
        // Premultiplied against the background: lines fade by darkening, which
        // keeps them cheap (no per-segment alpha) and fog-compatible.
        const bg = new THREE.Color(BG);
        const col = bg.clone().lerp(c, w);
        segCol.set([col.r, col.g, col.b, col.r, col.g, col.b], k * 6);
      });
      colAttr.needsUpdate = true;
      halos.forEach((h) => { (h.material as THREE.SpriteMaterial).opacity = targetDim[h.userData.i] > 0.5 ? 0.95 : 0.15; });
      if (focusIdx != null) {
        selRing.visible = true;
        selRing.position.copy(pos.get(nodes[focusIdx].id)!);
        selRing.scale.setScalar(R * targetScale[focusIdx] * 2.7);
      } else selRing.visible = false;
    }

    // Camera tween
    let tween: { t: number; fromP: THREE.Vector3; toP: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3 } | null = null;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function flyTo(target: THREE.Vector3, dist: number) {
      const dir = camera.position.clone().sub(controls.target).normalize();
      const toP = target.clone().addScaledVector(dir, dist);
      if (reduce) { controls.target.copy(target); camera.position.copy(toP); return; }
      tween = { t: 0, fromP: camera.position.clone(), toP, fromT: controls.target.clone(), toT: target.clone() };
    }

    // Initial framing
    const box = new THREE.Box3();
    pos.forEach((p) => box.expandByPoint(p));
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const homeDist = Math.max(120, sphere.radius * 1.7);
    controls.target.copy(sphere.center);
    camera.position.copy(sphere.center).add(new THREE.Vector3(0.25, 0.35, 1).normalize().multiplyScalar(homeDist));
    controls.maxDistance = homeDist * 3;

    apiRef.current = {
      focus(slug) {
        focusIdx = slug == null ? null : idxBySlug.get(slug) ?? null;
        applyFocus();
        if (focusIdx != null) { controls.autoRotate = false; flyTo(pos.get(nodes[focusIdx].id)!, 170); }
      },
      highlightRegion(id) {
        regionFocus = id;
        applyFocus();
      },
    };
    applyFocus();
    if (selectedRef.current) apiRef.current.focus(selectedRef.current);

    // ── Interaction ───────────────────────────────────────────────────────
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function pick(ev: PointerEvent | MouseEvent): number | null {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObject(mesh, false);
      for (const h of hits) if (h.instanceId != null && targetDim[h.instanceId] > 0.5) return h.instanceId;
      return null;
    }
    let down = { x: 0, y: 0 };
    const el = renderer.domElement;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; controls.autoRotate = false; };
    const onUp = (e: PointerEvent) => {
      if ((e.clientX - down.x) ** 2 + (e.clientY - down.y) ** 2 > 25) return;
      const i = pick(e);
      onSelectRef.current(i == null ? null : nodes[i].slug);
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
    el.addEventListener("pointerup", onUp);
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

    let raf = 0;
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
      const ease = 1 - Math.exp(-dt * 10);
      for (let i = 0; i < nodes.length; i++) {
        curScale[i] += (targetScale[i] * (i === hoverIdx ? 1.25 : 1) - curScale[i]) * ease;
        curDim[i] += (targetDim[i] - curDim[i]) * ease;
        sc.setScalar(curScale[i]);
        m4.compose(pos.get(nodes[i].id)!, q, sc);
        mesh.setMatrixAt(i, m4);
        tmpC.copy(bases[i]);
        tmpC.lerp(bgC, 1 - curDim[i]);
        mesh.setColorAt(i, tmpC);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      controls.update();
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
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
      <div ref={hostRef} className="g3d-host" role="img" aria-label="3D knowledge graph. Switch to List view for a keyboard-navigable equivalent." />
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
      <p className="map-hint">Drag to orbit · scroll to zoom · right-drag to pan · click a node</p>
    </div>
  );
}
