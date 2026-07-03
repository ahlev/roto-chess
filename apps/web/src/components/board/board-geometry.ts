/**
 * Board geometry — THE ONLY FILE WHERE TRIGONOMETRY LIVES.
 *
 * Generates the 128 static annular-sector paths, centroids, meridian lines,
 * and numeral anchors from the reference geometry (inner rail r=120, outer
 * r=280, viewBox 680), keyed by the engine's integer square ids. Everything
 * else in the app consumes these precomputed tables; the engine itself is
 * integer-only. If Math.atan2 or Math.sin appears outside this file, it's
 * a bug.
 *
 * Angle convention: degrees CLOCKWISE from 12 o'clock (north). The North
 * meridian (boundary display 32|1) sits at 0°; internal rank r spans
 * [r*11.25°, (r+1)*11.25°). Per-seat rotation is applied by rotating the
 * SVG group, never by recomputing these tables.
 */

import {
  FILE_COUNT,
  RANK_COUNT,
  SQUARE_COUNT,
  fileOf,
  rankOf,
  squareColor,
  squareOf,
  type Seat,
  type Square,
} from "@rotochess/engine";

// 600 leaves just enough margin for the meridian overhang + strokes; the
// annulus fills 93% of the box so a 351pt phone render keeps its cells at
// the spec's tap-target sizes (a 680 box wasted 60 units per side).
export const VIEWBOX = 600;
export const CENTER = VIEWBOX / 2; // 300
export const INNER_R = 120;
export const OUTER_R = 280;
export const RING_W = (OUTER_R - INNER_R) / FILE_COUNT; // 40
export const SECTOR_DEG = 360 / RANK_COUNT; // 11.25

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Point at `deg` clockwise from north, radius `r`, centered. */
export function polarPoint(deg: number, r: number): { x: number; y: number } {
  return {
    x: CENTER + r * Math.sin(rad(deg)),
    y: CENTER - r * Math.cos(rad(deg)),
  };
}

function fmt(n: number): string {
  return n.toFixed(2);
}

/** Annular-sector path for one square. */
function sectorPath(rank: number, file: number): string {
  const a0 = rank * SECTOR_DEG;
  const a1 = a0 + SECTOR_DEG;
  const r0 = INNER_R + file * RING_W;
  const r1 = r0 + RING_W;
  const p1 = polarPoint(a0, r1);
  const p2 = polarPoint(a1, r1);
  const p3 = polarPoint(a1, r0);
  const p4 = polarPoint(a0, r0);
  return [
    `M ${fmt(p1.x)} ${fmt(p1.y)}`,
    `A ${r1} ${r1} 0 0 1 ${fmt(p2.x)} ${fmt(p2.y)}`,
    `L ${fmt(p3.x)} ${fmt(p3.y)}`,
    `A ${r0} ${r0} 0 0 0 ${fmt(p4.x)} ${fmt(p4.y)}`,
    "Z",
  ].join(" ");
}

export interface SquareGeometry {
  square: Square;
  path: string;
  /** Cell centroid (mid-angle, mid-radius). */
  cx: number;
  cy: number;
  /** Mid-angle in degrees clockwise from north. */
  midDeg: number;
  /** Mid radius. */
  midR: number;
  /** 0 dark (umber) | 1 light (cream). */
  color: 0 | 1;
}

/** All 128 squares, index = engine square id. Computed once at module load. */
export const SQUARES: readonly SquareGeometry[] = (() => {
  const out: SquareGeometry[] = [];
  for (let sq = 0; sq < SQUARE_COUNT; sq++) {
    const rank = rankOf(sq);
    const file = fileOf(sq);
    const midDeg = rank * SECTOR_DEG + SECTOR_DEG / 2;
    const midR = INNER_R + file * RING_W + RING_W / 2;
    const { x, y } = polarPoint(midDeg, midR);
    out.push({
      square: sq,
      path: sectorPath(rank, file),
      cx: x,
      cy: y,
      midDeg,
      midR,
      color: squareColor(sq),
    });
  }
  return out;
})();

/** The four meridian lines (inner→outer radial segments) at N/E/S/W. */
export const MERIDIAN_LINES: ReadonlyArray<{
  seat: Seat;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  deg: number;
}> = ([1, 2, 3, 4] as const).map((seat) => {
  const deg = (seat - 1) * 90;
  const inner = polarPoint(deg, INNER_R - 2);
  const outer = polarPoint(deg, OUTER_R + 2);
  return { seat, deg, x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
});

/** Numeral anchors: display rank labels printed inside the center hole. */
export const NUMERAL_ANCHORS: ReadonlyArray<{
  display: number;
  x: number;
  y: number;
  deg: number;
}> = (() => {
  const out: Array<{ display: number; x: number; y: number; deg: number }> = [];
  for (let rank = 0; rank < RANK_COUNT; rank++) {
    const deg = rank * SECTOR_DEG + SECTOR_DEG / 2;
    const { x, y } = polarPoint(deg, INNER_R - 14);
    out.push({ display: rank + 1, x, y, deg });
  }
  return out;
})();

/**
 * Polar hit-testing: SVG-space point → square id, or null outside the
 * annulus. One listener on the whole board; cells tile with zero gaps, so
 * every tap lands somewhere valid (the UX consultation's layer 1).
 * `rotationDeg` is the board-group rotation currently applied.
 */
export function hitTest(
  x: number,
  y: number,
  rotationDeg = 0,
): Square | null {
  const dx = x - CENTER;
  const dy = y - CENTER;
  const r = Math.hypot(dx, dy);
  if (r < INNER_R || r > OUTER_R) return null;
  // atan2 with our clockwise-from-north convention, minus board rotation.
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI - rotationDeg;
  deg = ((deg % 360) + 360) % 360;
  const rank = Math.floor(deg / SECTOR_DEG);
  const file = Math.floor((r - INNER_R) / RING_W);
  return squareOf(rank, Math.min(file, FILE_COUNT - 1));
}

/**
 * Board rotation per seat: the viewer's own meridian sits at 6 o'clock
 * (own quadrant nearest). Red/N 180 would put N at bottom… the convention
 * from the UX consultation: red 0°, black −90°, blue 180°, gold +90° puts
 * each seat's MERIDIAN at the bottom given the canonical render has North
 * at 12 o'clock: seat 1 needs N rotated to 6 o'clock → 180°? No — the
 * consultation's numbers are relative to its own canonical which already
 * frames the board for red. We define it concretely: rotate the canonical
 * (N at top) so the seat's meridian angle (seat-1)*90 lands at 180°.
 */
export function rotationForSeat(seat: Seat): number {
  return 180 - (seat - 1) * 90;
}

/**
 * Move-path rendering: build one smooth SVG path through cell centroids.
 * Circumferential runs become true arcs at the centerline radius; radial
 * legs are straight; bishop curls flow through per-cell points smoothed
 * with a Catmull-Rom pass. Input is the engine move's path (origin
 * excluded), so we prepend the origin square.
 */
export function movePathD(from: Square, path: readonly Square[]): string {
  const points = [from, ...path].map((sq) => {
    const g = SQUARES[sq] as SquareGeometry;
    return { x: g.cx, y: g.cy, deg: g.midDeg, r: g.midR };
  });
  if (points.length < 2) return "";

  const parts: string[] = [`M ${fmt(points[0]!.x)} ${fmt(points[0]!.y)}`];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const sameRing = Math.abs(prev.r - cur.r) < 0.01;
    if (sameRing) {
      // Circumferential leg: a true arc at the centerline radius. Sweep
      // direction from the (short) angular delta.
      let delta = cur.deg - prev.deg;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      const sweep = delta > 0 ? 1 : 0;
      parts.push(
        `A ${fmt(cur.r)} ${fmt(cur.r)} 0 0 ${sweep} ${fmt(cur.x)} ${fmt(cur.y)}`,
      );
    } else {
      // Radial or diagonal step: smooth with a quadratic through the
      // midpoint pulled toward the true mid-angle/mid-radius (cheap
      // Catmull-Rom-ish pass that renders curls as visible bends).
      let delta = cur.deg - prev.deg;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      const midDeg = prev.deg + delta / 2;
      const midR = (prev.r + cur.r) / 2;
      const c = polarPoint(midDeg, midR);
      parts.push(`Q ${fmt(c.x)} ${fmt(c.y)} ${fmt(cur.x)} ${fmt(cur.y)}`);
    }
  }
  return parts.join(" ");
}

/** Squared distance helper for legal-move snap (UX layer 2). */
export function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Inverse of the board group rotation: screen/viewBox point → canonical board space. */
export function toBoardSpace(
  x: number,
  y: number,
  rotationDeg: number,
): { x: number; y: number } {
  const r = rad(-rotationDeg);
  return {
    x: CENTER + (x - CENTER) * Math.cos(r) - (y - CENTER) * Math.sin(r),
    y: CENTER + (x - CENTER) * Math.sin(r) + (y - CENTER) * Math.cos(r),
  };
}

/**
 * Legal-move snap (UX layer 2) — the whole policy in one tested place.
 * A tap snaps to the nearest legal target within `radius` ONLY when doing
 * so cannot steal a deliberate tap: never away from a directly-hit legal
 * target, never away from a square the snapper says is protected (the
 * active seat's own pieces — re-selection must always win), and only when
 * the tap is closer to the target's centroid than to its own cell's.
 */
export function snapToTargets(
  x: number,
  y: number,
  rotationDeg: number,
  targets: ReadonlySet<Square>,
  isProtected: (sq: Square) => boolean,
  radius = 38, // ≈22pt at a 351pt render of the 600 viewBox
): Square | null {
  const direct = hitTest(x, y, rotationDeg);
  if (direct !== null && targets.has(direct)) return direct;
  if (direct !== null && isProtected(direct)) return direct;
  const p = toBoardSpace(x, y, rotationDeg);
  let best: { sq: Square; d: number } | null = null;
  for (const t of targets) {
    const g = SQUARES[t];
    if (!g) continue;
    const d = distSq(p.x, p.y, g.cx, g.cy);
    if (d <= radius * radius && (!best || d < best.d)) best = { sq: t, d };
  }
  if (best === null) return direct;
  if (direct !== null) {
    const own = SQUARES[direct];
    if (own && distSq(p.x, p.y, own.cx, own.cy) < best.d) return direct;
  }
  return best.sq;
}
