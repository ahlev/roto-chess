/**
 * Beat 3 (local 0–240): the board tilts (0–24), four planes lift apart
 * (24–60, staggered 120 ms), labels fade in with each plane, the heartbeat
 * draws (60–200), the chip turns green at 200, planes re-stack (180–210).
 * Type enters at 60.
 */
import { useCurrentFrame } from "remotion";
import { Meridians, Pieces, Rails, Squares, cellCentroid, mapPoint, movePathD } from "../board/Board";
import { useSprites } from "../board/sprites";
import { SCRIPT, piecesOf } from "../board/script";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { DUR, fade, tween } from "../motion";
import { PALETTE, SEAT_COLOR } from "../theme";
import { Chip } from "../ui/Chip";
import { LowerThird } from "../ui/LowerThird";
import { SceneFrame } from "./SceneFrame";

const PLANES = [
  { name: "Input", sub: "tap · path · confirm" },
  { name: "Events", sub: "halo · evaporation · Avenger" },
  { name: "Pieces", sub: "upright, counter-rotated" },
  { name: "Geometry", sub: "128 sectors, four meridians" },
] as const;

export const Scene3Ground = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const sprites = useSprites();
  const L = layout.ground;
  const ky = tween(frame, 0, 800, 1, L.ky);
  const base = L.planeY[3];
  // Each plane rises from the geometry plane's y to its own y; all re-stack from 180.
  const lift = (i: number) => {
    const up = tween(frame, 24 + i * 4, 900, 0, 1);
    const down = tween(frame, 180, 1000, 0, 1);
    return base + (L.planeY[i]! - base) * up * (1 - down);
  };
  const Tn = (i: number) => ({ cx: L.cx, cy: lift(i), s: L.s, ky });
  const T4 = Tn(3), T3 = Tn(2), T2 = Tn(1), T1 = Tn(0);
  const sep = tween(frame, 24, 900, 0, 1) * (1 - tween(frame, 180, 1000, 0, 1));
  const pieces = piecesOf(SCRIPT.states[0]!);
  const haloAt = mapPoint(T2, cellCentroid(12, 2));
  const evapAt = mapPoint(T2, cellCentroid(23, 1));
  const aveAt = mapPoint(T2, cellCentroid(1, 0));
  const sel = mapPoint(T1, cellCentroid(18, 2));
  const dest = mapPoint(T1, cellCentroid(22, 2));
  const hbLen = 1140;
  const hb = tween(frame, 60, 4600, hbLen, 0);
  const green = frame >= 200;
  return (
    <SceneFrame layout={layout} id="s3">
      <Squares T={T4} />
      <Rails T={T4} />
      <Meridians T={T4} />
      <g opacity={sep}>
        <Rails T={T3} color="#4a3f31" />
        <Meridians T={T3} width={2} opacity={0.25} />
      </g>
      {sprites ? <Pieces T={T3} pieces={pieces} sprites={sprites} size={30} /> : null}
      <g opacity={sep}>
        <Rails T={T2} color="#4a3f31" />
        <Meridians T={T2} width={2} opacity={0.25} />
        <ellipse cx={haloAt.x} cy={haloAt.y} rx="26" ry="11" fill="none" stroke={PALETTE.halo} strokeWidth="4" />
        <ellipse cx={haloAt.x} cy={haloAt.y} rx="44" ry="19" fill="none" stroke={PALETTE.halo} strokeWidth="2" opacity="0.4" />
        {[[0, -4, 3], [8, -16, 2.4], [-7, -26, 2], [5, -38, 1.6]].map(([dx, dy, r], i) => <circle key={i} cx={evapAt.x + dx!} cy={evapAt.y + dy!} r={r} fill={PALETTE.evaporate} />)}
        <ellipse cx={aveAt.x} cy={aveAt.y} rx="30" ry="13" fill="none" stroke={PALETTE.boardMeridian} strokeWidth="3" />
        <ellipse cx={aveAt.x} cy={aveAt.y} rx="54" ry="23" fill="none" stroke={PALETTE.boardMeridian} strokeWidth="2" opacity="0.45" />
        <Rails T={T1} color="#4a3f31" />
        <Meridians T={T1} width={2} opacity={0.25} />
        <ellipse cx={sel.x} cy={sel.y} rx="28" ry="12" fill={SEAT_COLOR[3]} fillOpacity="0.25" stroke={SEAT_COLOR[3]} strokeWidth="2.5" />
        <path d={movePathD(T1, [[18, 2], [19, 1], [20, 0], [21, 1], [22, 2]])} fill="none" stroke={SEAT_COLOR[3]} strokeWidth="4" strokeLinecap="round" strokeDasharray="10 12" />
        <ellipse cx={dest.x} cy={dest.y} rx="9" ry="4" fill={SEAT_COLOR[3]} />
        <Chip x={L.confirmChip.x} y={L.confirmChip.y} w={250} h={46} label="B C19 → C23   Confirm" color={SEAT_COLOR[3]} size={21} />
        {PLANES.map((p, i) => (
          <g key={p.name} opacity={fade(frame, 30 + i * 4, DUR.slow)}>
            <text x={L.labelX} y={lift(i) - 6} fontFamily={FONTS.sans} fontSize="34" fontWeight="500" fill={PALETTE.text}>{p.name}</text>
            <text x={L.labelX} y={lift(i) + 26} fontFamily={FONTS.sans} fontSize="19" fill={PALETTE.textDim}>{p.sub}</text>
            <line x1={L.labelX + 300} y1={lift(i)} x2={L.leaderEndX} y2={lift(i)} stroke={PALETTE.line} strokeWidth="1.5" strokeDasharray="4 8" />
          </g>
        ))}
      </g>
      <g transform={`translate(${L.heartbeat.x} ${L.heartbeat.y})`}>
        <path pathLength={hbLen} d="M0 0 H200 l14 -34 l18 60 l16 -42 l10 16 H520 l14 -34 l18 60 l16 -42 l10 16 H900 l14 -34 l18 60 l16 -42 l10 16 H1140" fill="none" stroke={PALETTE.success} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={hbLen} strokeDashoffset={hb} />
      </g>
      <Chip x={L.engineChip.x} y={L.engineChip.y} w={L.engineChip.w} h={48} label={green ? "engine 0.3.0 · live · 0 errors" : "engine 0.3.0 · deploying…"} color={green ? PALETTE.success : PALETTE.textDim} size={20} opacity={fade(frame, 60, DUR.slow)} />
      <LowerThird text="First, make it unbreakable." enterAt={60} layout={layout} id="s3" />
    </SceneFrame>
  );
};
