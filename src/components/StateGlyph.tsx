import type { SliceNode } from "@/lib/graph";

/**
 * One visual language for "your relationship to a node", used by the 3D graph,
 * its legend and the list view.
 *
 *   Colour  = domain (region). It never changes with state.
 *   Size, brightness and a ring = your relationship to the node.
 *
 *   Held             big, bright, solid amber ring
 *   Staked           held, plus a second amber ring (you claimed expertise)
 *   Thin             medium, dimmer, dashed amber ring (you held it; it is fading)
 *   Frontier         medium, dashed pale ring, pulsing (your next step)
 *   Held by others   smaller, plain, no ring
 *   Not yet mapped   smallest, darkest, no ring
 */

export type NodeState = SliceNode["state"];

export const STATE_META: Record<NodeState, { label: string; desc: string }> = {
  held: { label: "Held", desc: "You hold this ground." },
  thin: { label: "Thin", desc: "You held it and it is fading. Revisit it." },
  frontier: { label: "Frontier", desc: "Your next step: one link from something you hold." },
  mapped: { label: "Held by others", desc: "Someone else holds it. You don't yet." },
  unmapped: { label: "Not yet mapped", desc: "Nobody holds it yet." },
};

export const STATE_ORDER: NodeState[] = ["held", "frontier", "thin", "mapped", "unmapped"];

/** Fill lightness/saturation and relative size per state (shared with the 3D scene). */
export const STATE_LOOK: Record<NodeState, { scale: number; light: number; sat: number }> = {
  held: { scale: 1.9, light: 0.66, sat: 0.85 },
  thin: { scale: 1.5, light: 0.46, sat: 0.6 },
  frontier: { scale: 1.4, light: 0.58, sat: 0.7 },
  mapped: { scale: 1.15, light: 0.56, sat: 0.62 },
  unmapped: { scale: 0.85, light: 0.36, sat: 0.4 },
};

export const AMBER = "#f3c14b";
export const FRONTIER_RING = "#c9d3ff";

export default function StateGlyph({
  state,
  staked = false,
  hue = 215,
  size = 24,
}: {
  state: NodeState;
  staked?: boolean;
  hue?: number;
  size?: number;
}) {
  const look = STATE_LOOK[state];
  const r = 3.2 * look.scale;
  const fill = `hsl(${hue} ${Math.round(look.sat * 100)}% ${Math.round(look.light * 100)}%)`;
  return (
    <svg width={size} height={size} viewBox="-14 -14 28 28" aria-hidden="true" style={{ flex: "none" }}>
      {state === "held" && <circle r={r + 3.2} fill="none" stroke={AMBER} strokeWidth="1.6" />}
      {state === "held" && staked && <circle r={r + 6.4} fill="none" stroke={AMBER} strokeWidth="1.2" opacity="0.75" />}
      {state === "thin" && <circle r={r + 3.2} fill="none" stroke={AMBER} strokeWidth="1.5" strokeDasharray="2.4 2.2" opacity="0.6" />}
      {state === "frontier" && <circle r={r + 3.2} fill="none" stroke={FRONTIER_RING} strokeWidth="1.5" strokeDasharray="2.4 2.2" />}
      <circle r={r} fill={fill} />
    </svg>
  );
}
