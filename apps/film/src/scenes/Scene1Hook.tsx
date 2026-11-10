/**
 * Beat 1 (0–210): the North meridian draws (0–21), the annulus resolves
 * clockwise from pencil outline to solid (21–93), a North pawn glides to the
 * far side of the meridian (100–112) and evaporates (112–133) with motes
 * rising (133–170). Type enters at 156 (5.2 s). The pawn's crossing is an
 * illustrative staging of §6.3; the resolve and board are engine geometry.
 */
import { useCurrentFrame } from "remotion";
import { Meridians, Pieces, Rails, Sprite, Squares, cellCentroid, mapPoint, pointAlongCells } from "../board/Board";
import type { SquareStyle } from "../board/Board";
import { useSprites } from "../board/sprites";
import { SCRIPT, piecesOf } from "../board/script";
import { INNER_R, OUTER_R, SECTOR_DEG, polarPoint } from "../board/geometry";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { DUR, fade, tween } from "../motion";
import { PALETTE, SEAT_COLOR } from "../theme";
import { LowerThird } from "../ui/LowerThird";
import { SceneFrame } from "./SceneFrame";

/** Glide from the block edge across the North meridian to the first vacant cell past the block. */
const PAWN_CELLS: [number, number][] = [[30, 1], [31, 1], [0, 1], [1, 1], [2, 1]];
const MOTES: [number, number, number][] = [[-6, -26, 3.2], [10, -40, 2.4], [-18, -48, 2], [16, -60, 1.6], [2, -74, 1.4], [-10, -86, 1.1]];

export const Scene1Hook = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const sprites = useSprites();
  const T = layout.hero;
  const meridianDraw = tween(frame, 0, DUR.ceremony, 0, 1);
  const sweepDeg = tween(frame, 21, 2400, 0, 360);
  const style: SquareStyle = (rank, _file, col) => {
    const deg = rank * SECTOR_DEG + SECTOR_DEG / 2;
    if (deg < sweepDeg) return { fill: col };
    const ahead = Math.min(1, (deg - sweepDeg) / 140);
    return { fill: "none", stroke: PALETTE.boardCream, strokeWidth: 0.9 - 0.5 * ahead, opacity: 0.55 - 0.35 * ahead };
  };
  const a = mapPoint(T, polarPoint(0, INNER_R - 2));
  const b = mapPoint(T, polarPoint(0, OUTER_R + 2));
  const pawnT = tween(frame, 100, DUR.slow, 0, 1);
  const pawnAt = frame < 100 ? mapPoint(T, cellCentroid(30, 1)) : pointAlongCells(T, PAWN_CELLS, pawnT);
  const evap = tween(frame, 112, DUR.ceremony, 1, 0);
  const pawnScale = 0.6 + 0.4 * evap;
  const pawnOpacity = frame < 112 ? 1 : evap;
  const moteRise = tween(frame, 133, 1200, 0, 1);
  const moteOpacity = frame < 133 ? 0 : 1 - moteRise;
  const pieces = piecesOf(SCRIPT.states[0]!).filter((p) => !(p.rank === 30 && p.file === 1));
  const visible = (p: { rank: number }) => p.rank * SECTOR_DEG + SECTOR_DEG / 2 < sweepDeg - 10;
  const end = mapPoint(T, cellCentroid(2, 1));
  return (
    <SceneFrame layout={layout} id="s1">
      <circle cx={T.cx} cy={T.cy} r={OUTER_R * T.s + 40} fill="url(#glow-s1)" opacity={0.18 * fade(frame, 21, 1000)} />
      <Squares T={T} style={style} />
      <Rails T={T} />
      <Meridians T={T} width={3.5} opacity={0.35 * fade(frame, 40, 1000)} />
      <line x1={a.x} y1={a.y} x2={a.x + (b.x - a.x) * meridianDraw} y2={a.y + (b.y - a.y) * meridianDraw} stroke={SEAT_COLOR[1]} strokeWidth="5" strokeLinecap="round" />
      {sprites ? <Pieces T={T} pieces={pieces} sprites={sprites} filter={visible} /> : null}
      {sprites && frame >= 60 ? <Sprite sprites={sprites} piece={{ rank: 30, file: 1, seat: 1, kind: "P" }} at={pawnAt} size={34 * T.s} opacity={pawnOpacity} scale={pawnScale} /> : null}
      {MOTES.map(([dx, dy, r], i) => (
        <circle key={i} cx={end.x + dx} cy={end.y + dy * moteRise} r={r} fill={PALETTE.evaporate} opacity={moteOpacity * (0.9 - r * 0.15)} />
      ))}
      <text x={T.cx} y={T.cy + 10} fontFamily={FONTS.mono} fontSize="34" fill={PALETTE.textDim} textAnchor="middle" letterSpacing="10" opacity={fade(frame, 90, 1000)}>ROTO</text>
      <LowerThird text="Four players. One ring. Rules chess never had." enterAt={156} layout={layout} id="s1" />
    </SceneFrame>
  );
};
