/**
 * Beat 7 (local 0–210): the flat board tilts into perspective, Staunton
 * silhouettes rise from the sprites, red meridian curtains stand up, the
 * camera pans over South's shoulder for the knight's engine-legal leap, then
 * settles to the centered overview. Pose from scene7Pose (tested).
 */
import { useCurrentFrame } from "remotion";
import { Meridians, Pieces, Rails, Squares, cellCentroid, mapPoint } from "../board/Board";
import type { BoardTransform } from "../board/Board";
import { useSprites } from "../board/sprites";
import { cellsOf, heroKnight, piecesOf } from "../board/script";
import { INNER_R, OUTER_R, polarPoint } from "../board/geometry";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { DUR, fade } from "../motion";
import { PALETTE, SEAT_COLOR } from "../theme";
import { LowerThird } from "../ui/LowerThird";
import { Staunton } from "../ui/Staunton";
import { SceneFrame } from "./SceneFrame";
import { scene7Pose } from "./scene7Pose";

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const Scene7Depth = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const sprites = useSprites();
  const pose = scene7Pose(frame);
  const s = pose.s * layout.depth.sMul;
  const T: BoardTransform = { cx: layout.depth.cx + pose.cx, cy: layout.depth.cy + pose.cy, s, ky: pose.ky };
  const { move, state } = heroKnight();
  const hero = state.board[move.from]!;
  const cells = cellsOf(move);
  const from = cells[0]!;
  const to = cells[cells.length - 1]!;
  const pieces = piecesOf(state);
  const placed = pieces.map((p) => ({ ...p, ...mapPoint(T, cellCentroid(p.rank, p.file)) })).sort((a, b) => a.y - b.y);
  const kFrom = mapPoint(T, cellCentroid(from[0], from[1]));
  const kTo = mapPoint(T, cellCentroid(to[0], to[1]));
  const u = pose.leap;
  const apex = Math.min(kFrom.y, kTo.y) - 190;
  const kx = (1 - u) * (1 - u) * kFrom.x + 2 * (1 - u) * u * ((kFrom.x + kTo.x) / 2) + u * u * kTo.x;
  const ky = (1 - u) * (1 - u) * kFrom.y + 2 * (1 - u) * u * apex + u * u * kTo.y;
  const curtain = fade(frame, 20, 1000);
  const yMin = T.cy - OUTER_R * T.s * pose.ky;
  const yMax = T.cy + OUTER_R * T.s * pose.ky;
  // The leap label sits inside the hole, right-aligned so its last letter clears the ring's inner edge.
  const holeA = INNER_R * s;
  const holeB = INNER_R * s * pose.ky;
  const labelY = apex - 10;
  const labelDy = Math.max(-0.9, Math.min(0.9, (labelY - T.cy) / holeB));
  const labelX = T.cx + holeA * Math.sqrt(1 - labelDy * labelDy) - 24;
  return (
    <SceneFrame layout={layout} id="s7">
      <defs>
        <linearGradient id="curtain-s7" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={PALETTE.boardMeridian} stopOpacity="1" />
          <stop offset="100%" stopColor={PALETTE.boardMeridian} stopOpacity="0" />
        </linearGradient>
      </defs>
      <Squares T={T} />
      <Rails T={T} />
      <Meridians T={T} width={4} />
      {([1, 2, 3, 4] as const).map((seat) => {
        const deg = (seat - 1) * 90;
        const a = mapPoint(T, polarPoint(deg, INNER_R));
        const b = mapPoint(T, polarPoint(deg, OUTER_R));
        const hgt = 120 * curtain;
        // Per-seat strength (0.22 North, 0.14 others) x3: the gradient and the hairlines are thinner than the old flat slab and would vanish at the raw value.
        const op = Math.min(1, (seat === 1 ? 0.22 : 0.14) * 3) * curtain;
        // North/South meridians run along the view axis, so their curtains are edge-on: draw two standing edges and a faint top edge.
        if (seat === 1 || seat === 3) {
          return (
            <g key={seat} stroke={PALETTE.boardMeridian} strokeLinecap="round" opacity={op}>
              <line x1={a.x} y1={a.y} x2={a.x} y2={a.y - hgt} strokeWidth="2" />
              <line x1={b.x} y1={b.y} x2={b.x} y2={b.y - hgt} strokeWidth="2" />
              <line x1={a.x} y1={a.y - hgt} x2={b.x} y2={b.y - hgt} strokeWidth="1" opacity="0.5" />
            </g>
          );
        }
        return <polygon key={seat} points={`${a.x},${a.y} ${b.x},${b.y} ${b.x},${b.y - hgt} ${a.x},${a.y - hgt}`} fill="url(#curtain-s7)" opacity={op} />;
      })}
      {sprites && pose.rise < 1 ? <Pieces T={T} pieces={pieces} sprites={sprites} size={34 * s * (1 - pose.rise)} opacity={1 - pose.rise} /> : null}
      {pose.rise > 0
        ? placed.map((p) => {
            if (p.rank === from[0] && p.file === from[1]) return null;
            const depth = (p.y - yMin) / Math.max(1, yMax - yMin);
            const h = (0.75 + depth * 0.7) * pose.rise;
            const op = 1 - 0.4 * smoothstep(0.8, 1, depth);
            return <Staunton key={`${p.rank}-${p.file}`} x={p.x} y={p.y} seat={p.seat} kind={p.kind} h={h} opacity={op} />;
          })
        : null}
      {pose.rise > 0 ? (
        <g>
          <path d={`M ${kFrom.x} ${kFrom.y} Q ${(kFrom.x + kTo.x) / 2} ${apex} ${kTo.x} ${kTo.y}`} fill="none" stroke={SEAT_COLOR[3]} strokeWidth="5" strokeDasharray="6 14" strokeLinecap="round" opacity={fade(frame, 70, DUR.base)} />
          <ellipse cx={kTo.x} cy={kTo.y} rx="22" ry="9" fill="none" stroke={SEAT_COLOR[3]} strokeWidth="3" opacity={fade(frame, 70, DUR.base)} />
          <Staunton x={kx} y={ky} seat={hero.seat} kind={hero.kind} h={(1.25 + 0.35 * Math.sin(u * Math.PI)) * pose.rise} />
          <text x={labelX} y={labelY} textAnchor="end" fontFamily={FONTS.mono} fontSize="20" fill={SEAT_COLOR[3]} opacity={fade(frame, 80, DUR.base)}>South knight · leap</text>
        </g>
      ) : null}
      <g stroke={PALETTE.textDim} strokeWidth="2" fill="none" opacity={0.5 * fade(frame, 36, DUR.slow)}>
        <path d="M120 120 v-40 h40" />
        <path d={`M${layout.width - 120} 120 v-40 h-40`} />
        <path d={`M120 ${layout.height - 120} v40 h40`} />
        <path d={`M${layout.width - 120} ${layout.height - 120} v40 h-40`} />
      </g>
      <text x={layout.width / 2} y="110" fontFamily={FONTS.mono} fontSize="20" fill={PALETTE.textDim} textAnchor="middle" letterSpacing="2" opacity={fade(frame, 36, DUR.slow)}>ORRERY CAM · over the shoulder · settles to the centered overview</text>
      <LowerThird text="See the move the way it felt." enterAt={60} layout={layout} id="s7" />
    </SceneFrame>
  );
};
