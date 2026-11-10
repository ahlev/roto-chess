/**
 * Beat 5 (local 0–240): close on West's quadrant. The hero bishop travels
 * its engine path (20–32, 400 ms), sets down (32–37), the halo inscribes
 * (37–58) then bloom rings expand and fade (58–100); chime arcs appear at
 * 40/52/64; the lens grows at 90–98; the caption slides in at 100. Type
 * enters at 70. The halo is a staged visual on a legal move.
 */
import { useCurrentFrame } from "remotion";
import { Meridians, Numerals, Pieces, Rails, Sprite, Squares, cellCentroid, mapPoint, movePathD, pointAlongCells } from "../board/Board";
import type { BoardTransform, SquareStyle } from "../board/Board";
import { useSprites } from "../board/sprites";
import { cellsOf, heroBishop, piecesOf } from "../board/script";
import { CENTER } from "../board/geometry";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { DUR, fade, tween } from "../motion";
import { PALETTE, SEAT_COLOR } from "../theme";
import { Chip } from "../ui/Chip";
import { LowerThird } from "../ui/LowerThird";
import { SceneFrame } from "./SceneFrame";

// Bloom window 58–100 = 42 frames at 30 fps = 1400 ms.
const BLOOM_MS = 1400;

export const Scene5Feel = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const sprites = useSprites();
  const { move, before } = heroBishop();
  const cells = cellsOf(move);
  const from = cells[0]!;
  const to = cells[cells.length - 1]!;
  // Center the crop on the hero move's midpoint so the composition follows the engine's path.
  const midCell = cells[Math.floor(cells.length / 2)]!;
  const mid = cellCentroid(midCell[0], midCell[1]);
  const L = layout.feel;
  const T: BoardTransform = { cx: L.cx - (mid.x - CENTER) * L.s, cy: L.cy - (mid.y - CENTER) * L.s, s: L.s };
  const travel = tween(frame, 20, DUR.slow, 0, 1);
  const setDown = tween(frame, 32, DUR.fast, 1.1, 1);
  const bishopAt = pointAlongCells(T, cells, travel);
  const landed = frame >= 32;
  const inscribe = tween(frame, 37, DUR.ceremony, 0, 1);
  const bloom = tween(frame, 58, BLOOM_MS, 0, 1);
  const bloomIn = fade(frame, 58, DUR.fast); // rings and glow start at 58, after the halo has inscribed
  const land = mapPoint(T, cellCentroid(to[0], to[1]));
  const pieces = piecesOf(before).filter((p) => !(p.rank === from[0] && p.file === from[1]));
  const style: SquareStyle = (rank, file, col) => ((rank === to[0] && file === to[1]) || (rank === from[0] && file === from[1]) ? { fill: col, stroke: PALETTE.lastMove, strokeWidth: 1.6 } : { fill: col, strokeWidth: 1.6 });
  const lensR = L.lens.r * tween(frame, 90, DUR.base, 0, 1);
  const zs = T.s * 1.9;
  const bp = cellCentroid(to[0], to[1]); // lens magnifies the landing square (the layout lens sits off-board, so it cannot sample under itself)
  const Tl: BoardTransform = { cx: L.lens.x - (bp.x - CENTER) * zs, cy: L.lens.y - (bp.y - CENTER) * zs, s: zs };
  const haloR = (34 * T.s) / 2 - 1;
  const circ = 2 * Math.PI * haloR;
  const caption = tween(frame, 100, DUR.base, -40, 0);
  const heroPiece = { rank: to[0], file: to[1], seat: 4 as const, kind: "B" as const };
  return (
    <SceneFrame layout={layout} id="s5">
      <Squares T={T} style={style} />
      <Rails T={T} />
      <Meridians T={T} width={4} />
      <Numerals T={T} />
      <path d={movePathD(T, cells)} fill="none" stroke={SEAT_COLOR[4]} strokeWidth="9" strokeLinecap="round" opacity={0.9 * fade(frame, 14, DUR.base)} />
      {sprites ? <Pieces T={T} pieces={pieces} sprites={sprites} /> : null}
      {sprites ? <Sprite sprites={sprites} piece={heroPiece} at={bishopAt} size={34 * T.s} scale={landed ? setDown : 1.08} /> : null}
      {landed ? (
        <g>
          <circle cx={land.x} cy={land.y} r={haloR} fill="none" stroke={PALETTE.halo} strokeWidth={Math.max(2, 34 * T.s * 0.07)} strokeDasharray={circ} strokeDashoffset={circ * (1 - inscribe)} transform={`rotate(-90 ${land.x} ${land.y})`} />
          {frame >= 58 ? (
            <g>
              <circle cx={land.x} cy={land.y} r={haloR + 110 * bloom} fill="none" stroke={PALETTE.halo} strokeWidth="3" opacity={0.5 * (1 - bloom) * bloomIn} />
              <circle cx={land.x} cy={land.y} r={haloR + 160 * bloom} fill="none" stroke={PALETTE.halo} strokeWidth="1.5" opacity={0.25 * (1 - bloom) * bloomIn} />
              <circle cx={land.x} cy={land.y} r={150} fill="url(#glow-s5)" opacity={0.5 * (1 - bloom) * bloomIn} />
            </g>
          ) : null}
          <g transform={`translate(${land.x + 110} ${land.y - 110})`} fill="none" stroke={PALETTE.halo} strokeWidth="3" strokeLinecap="round">
            <path d="M0 0 a24 24 0 0 1 0 -34" opacity={0.9 * fade(frame, 40, DUR.base) * (1 - bloom)} />
            <path d="M14 10 a44 44 0 0 1 0 -54" opacity={0.6 * fade(frame, 52, DUR.base) * (1 - bloom)} />
            <path d="M28 20 a64 64 0 0 1 0 -74" opacity={0.3 * fade(frame, 64, DUR.base) * (1 - bloom)} />
          </g>
        </g>
      ) : null}
      {lensR > 1 ? (
        <g>
          <clipPath id="lens-s5"><circle cx={L.lens.x} cy={L.lens.y} r={lensR} /></clipPath>
          <g clipPath="url(#lens-s5)">
            <rect width={layout.width} height={layout.height} fill={PALETTE.bg} />
            <Squares T={Tl} />
            <Rails T={Tl} />
            <Meridians T={Tl} width={4} />
            <Numerals T={Tl} />
            {sprites ? <Pieces T={Tl} pieces={pieces.concat([heroPiece])} sprites={sprites} /> : null}
          </g>
          <circle cx={L.lens.x} cy={L.lens.y} r={lensR} fill="none" stroke={PALETTE.text} strokeWidth="5" />
          <circle cx={L.lens.x} cy={L.lens.y} r={lensR + 10} fill="none" stroke={SEAT_COLOR[4]} strokeWidth="2" opacity="0.6" />
          <text x={L.lens.x} y={L.lens.y + lensR + 40} fontFamily={FONTS.sans} fontSize="22" fill={PALETTE.textDim} textAnchor="middle" opacity={fade(frame, 98, DUR.base)}>long-press lens · outer ring at 1.9×</text>
        </g>
      ) : null}
      <g transform={`translate(0 ${caption})`} opacity={fade(frame, 100, DUR.base)}>
        <Chip x={L.chip.x} y={L.chip.y} w={520} h={56} label="Halo earned · West bishop curl" color={SEAT_COLOR[4]} size={24} />
        <text x={L.chip.x} y={L.chip.y + 94} fontFamily={FONTS.mono} fontSize="22" fill={PALETTE.textDim}>set-down · chime · 400 ms settle</text>
      </g>
      <LowerThird text="Every move should land." enterAt={70} layout={layout} id="s5" />
    </SceneFrame>
  );
};
