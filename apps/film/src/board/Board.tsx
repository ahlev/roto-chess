/**
 * Board layers for film scenes. Every layer takes a BoardTransform that maps
 * the 576-unit board space to frame space (cx, cy = where the board center
 * lands; s = scale; ky = vertical squash for tilted views). Squares, rails
 * and meridians use an SVG group transform; pieces and numerals are placed
 * at mapped centroids and drawn upright, as the app does.
 */
import type { PieceKind, Seat } from "@rotochess/engine";
import { fileOf, rankOf, squareOf } from "@rotochess/engine";
import type { ReactNode } from "react";
import { CENTER, INNER_R, OUTER_R, SECTOR_DEG, SQUARES, polarPoint } from "./geometry";
import type { SpriteMap } from "./sprites";
import { PALETTE } from "../theme";

export interface BoardTransform {
  cx: number;
  cy: number;
  s: number;
  ky?: number;
}

export interface FilmPiece {
  rank: number;
  file: number;
  seat: Seat;
  kind: PieceKind;
  halo?: boolean;
}

const f2 = (n: number) => n.toFixed(2);

export function mapPoint(T: BoardTransform, p: { x: number; y: number }): { x: number; y: number } {
  return { x: T.cx + (p.x - CENTER) * T.s, y: T.cy + (p.y - CENTER) * T.s * (T.ky ?? 1) };
}

export function groupTransform(T: BoardTransform): string {
  return `translate(${T.cx} ${T.cy}) scale(${T.s} ${T.s * (T.ky ?? 1)}) translate(${-CENTER} ${-CENTER})`;
}

export function cellCentroid(rank: number, file: number): { x: number; y: number; deg: number; r: number } {
  const g = SQUARES[squareOf(rank, file)];
  if (!g) throw new Error(`no square ${rank}/${file}`);
  return { x: g.cx, y: g.cy, deg: g.midDeg, r: g.midR };
}

export type SquareStyle = (rank: number, file: number, color: string) => { fill: string; stroke?: string; strokeWidth?: number; opacity?: number } | null;

export const Squares = ({ T, style, opacity = 1 }: { T: BoardTransform; style?: SquareStyle; opacity?: number }) => (
  <g transform={groupTransform(T)} opacity={opacity}>
    {SQUARES.map((g) => {
      const rank = rankOf(g.square);
      const file = fileOf(g.square);
      const base = g.color === 1 ? PALETTE.boardCream : PALETTE.boardUmber;
      const st = style ? style(rank, file, base) : { fill: base };
      if (!st) return null;
      return (
        <path
          key={g.square}
          d={g.path}
          fill={st.fill}
          {...(st.stroke ? { stroke: st.stroke } : {})}
          {...(st.strokeWidth !== undefined ? { strokeWidth: st.strokeWidth } : {})}
          {...(st.opacity !== undefined ? { opacity: st.opacity } : {})}
        />
      );
    })}
  </g>
);

export const Rails = ({ T, color = "#5a4d3b" }: { T: BoardTransform; color?: string }) => (
  <g transform={groupTransform(T)}>
    <circle cx={CENTER} cy={CENTER} r={INNER_R} fill="none" stroke={color} strokeWidth={1.2 / T.s} />
    <circle cx={CENTER} cy={CENTER} r={OUTER_R} fill="none" stroke={color} strokeWidth={1.2 / T.s} />
  </g>
);

export const Meridians = ({ T, width = 3, opacity = 1, only }: { T: BoardTransform; width?: number; opacity?: number; only?: Seat }) => (
  <g transform={groupTransform(T)} opacity={opacity}>
    {([1, 2, 3, 4] as const).map((seat) => {
      if (only !== undefined && seat !== only) return null;
      const deg = (seat - 1) * 90;
      const a = polarPoint(deg, INNER_R - 2);
      const b = polarPoint(deg, OUTER_R + 2);
      return <line key={seat} x1={f2(a.x)} y1={f2(a.y)} x2={f2(b.x)} y2={f2(b.y)} stroke={PALETTE.boardMeridian} strokeWidth={width / T.s} strokeLinecap="round" />;
    })}
  </g>
);

export const Numerals = ({ T }: { T: BoardTransform }) => (
  <g>
    {Array.from({ length: 32 }, (_, rank) => {
      const q = mapPoint(T, polarPoint(rank * SECTOR_DEG + SECTOR_DEG / 2, INNER_R - 14));
      return (
        <text key={rank} x={f2(q.x)} y={f2(q.y)} fontSize={f2(7.5 * T.s)} fill={PALETTE.textDim} textAnchor="middle" dominantBaseline="middle" fontFamily="IBM Plex Mono, monospace">
          {rank + 1}
        </text>
      );
    })}
  </g>
);

export const Sprite = ({ sprites, piece, at, size, opacity = 1, scale = 1 }: { sprites: SpriteMap; piece: FilmPiece; at: { x: number; y: number }; size: number; opacity?: number; scale?: number }) => {
  const href = sprites[`${piece.seat}${piece.kind}`];
  if (!href) return null;
  const sz = size * scale;
  return (
    <g opacity={opacity}>
      {piece.halo ? <circle cx={f2(at.x)} cy={f2(at.y)} r={f2(sz / 2 - 1)} fill="none" stroke={PALETTE.halo} strokeWidth={f2(Math.max(2, sz * 0.07))} /> : null}
      <image href={href} x={f2(at.x - sz / 2)} y={f2(at.y - sz / 2)} width={f2(sz)} height={f2(sz)} preserveAspectRatio="xMidYMid meet" />
    </g>
  );
};

export const Pieces = ({ T, pieces, sprites, size, filter, opacity = 1 }: { T: BoardTransform; pieces: readonly FilmPiece[]; sprites: SpriteMap; size?: number; filter?: (p: FilmPiece) => boolean; opacity?: number }) => (
  <g opacity={opacity}>
    {pieces.filter((p) => !filter || filter(p)).map((p) => (
      <Sprite key={`${p.rank}-${p.file}`} sprites={sprites} piece={p} at={mapPoint(T, cellCentroid(p.rank, p.file))} size={size ?? 34 * T.s} />
    ))}
  </g>
);

/**
 * Path through cell centroids in frame space (port of the app's movePathD):
 * legs that stay on one ring are true circular arcs; legs that change ring
 * are quadratic curves through the polar midpoint. Arc radii assume ky = 1.
 */
export function movePathD(T: BoardTransform, cells: readonly [number, number][]): string {
  const pts = cells.map(([rank, file]) => {
    const c = cellCentroid(rank, file);
    return { ...mapPoint(T, c), deg: c.deg, r: c.r };
  });
  const first = pts[0];
  if (!first) return "";
  let d = `M ${f2(first.x)} ${f2(first.y)}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    let delta = b.deg - a.deg;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    if (Math.abs(a.r - b.r) < 0.01) {
      const rFrame = f2(a.r * T.s);
      const sweep = delta > 0 ? 1 : 0;
      d += ` A ${rFrame} ${rFrame} 0 0 ${sweep} ${f2(b.x)} ${f2(b.y)}`;
      continue;
    }
    const c = mapPoint(T, polarPoint(a.deg + delta / 2, (a.r + b.r) / 2));
    d += ` Q ${f2(c.x)} ${f2(c.y)} ${f2(b.x)} ${f2(b.y)}`;
  }
  return d;
}

/** Point at fraction t (0..1) along the cells, interpolated in polar space so arcs stay arcs. */
export function pointAlongCells(T: BoardTransform, cells: readonly [number, number][], t: number): { x: number; y: number } {
  const polar = cells.map(([rank, file]) => cellCentroid(rank, file));
  const legs = polar.length - 1;
  if (legs <= 0) return mapPoint(T, polar[0] ?? { x: CENTER, y: CENTER });
  const clamped = Math.min(1, Math.max(0, t));
  const pos = clamped * legs;
  const i = Math.min(legs - 1, Math.floor(pos));
  const u = pos - i;
  const a = polar[i]!;
  const b = polar[i + 1]!;
  let delta = b.deg - a.deg;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return mapPoint(T, polarPoint(a.deg + delta * u, a.r + (b.r - a.r) * u));
}

export const BoardSvg = ({ width, height, children }: { width: number; height: number; children: ReactNode }) => (
  <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: "block" }}>
    {children}
  </svg>
);
