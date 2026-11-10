/**
 * Beat 6 (local 0–240): plaques fill at 0/8/16/24; two bot moves play
 * (East's ply-13 move at 40–52, South's ply-14 move at 70–82) from the
 * scripted opening; the cut at 120 (42 s) folds the share card open
 * (120–132); reactions land at 140/145/150; the chat bubble rises at 160.
 * Type enters at 30 and holds through the cut.
 */
import type { PieceKind, Seat } from "@rotochess/engine";
import { useCurrentFrame } from "remotion";
import { Meridians, Pieces, Rails, Sprite, Squares, pointAlongCells } from "../board/Board";
import { useSprites } from "../board/sprites";
import { SCRIPT, cellsOf, piecesOf } from "../board/script";
import { FONTS } from "../fonts";
import type { Box, Layout } from "../layout";
import { DUR, fade, ms, tween } from "../motion";
import { PALETTE, SEAT_COLOR } from "../theme";
import { Chip } from "../ui/Chip";
import { LowerThird } from "../ui/LowerThird";
import { SceneFrame } from "./SceneFrame";

const BOT_MOVES = [
  { ply: 13, at: 40 },
  { ply: 14, at: 70 },
] as const;

/** Frames one bot move takes to animate before the position advances. */
const MOVE_FRAMES = ms(DUR.slow);

export const Scene6Alone = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const sprites = useSprites();
  const L = layout.alone;
  const T = { cx: L.cx, cy: L.cy, s: L.s };
  // Position: ply 13 before any bot move; each bot move's first submove animates, then the state advances.
  const done = BOT_MOVES.filter((m) => frame >= m.at + MOVE_FRAMES).length;
  const state = SCRIPT.states[13 + done]!;
  const active = BOT_MOVES.find((m) => frame >= m.at && frame < m.at + MOVE_FRAMES);
  let pieces = piecesOf(state);
  let mover: { at: { x: number; y: number }; seat: Seat; kind: PieceKind } | null = null;
  if (active) {
    const mv = SCRIPT.turns[active.ply]!.submoves[0];
    const cells = cellsOf(mv);
    const fromCell = cells[0]!;
    const p = state.board[mv.from]!;
    pieces = pieces.filter((q) => !(q.rank === fromCell[0] && q.file === fromCell[1]));
    mover = { at: pointAlongCells(T, cells, tween(frame, active.at, DUR.slow, 0, 1)), seat: p.seat, kind: p.kind };
  }
  const plaque = (b: Box, name: string, sub: string, color: string, bot: boolean, enterAt: number) => {
    const { x: px, y, w, h } = b;
    return (
      <g key={name + sub} opacity={fade(frame, enterAt, DUR.base)}>
        <rect x={px} y={y} width={w} height={h} rx="16" fill={PALETTE.surface} stroke={color} strokeWidth="2" />
        {bot ? (
          <g>
            <circle cx={px + 38} cy={y + 38} r="22" fill={PALETTE.bg} stroke={color} strokeWidth="2" />
            <circle cx={px + 38} cy={y + 38} r="12" fill="none" stroke={color} strokeWidth="2" />
            <circle cx={px + 38} cy={y + 38} r="3" fill={color} />
          </g>
        ) : (
          <g>
            <circle cx={px + 38} cy={y + 38} r="22" fill={color} />
            <text x={px + 38} y={y + 46} fontFamily={FONTS.sans} fontSize="22" fontWeight="600" fill={PALETTE.bg} textAnchor="middle">A</text>
          </g>
        )}
        <text x={px + 76} y={y + 33} fontFamily={FONTS.sans} fontSize="22" fontWeight="600" fill={PALETTE.text}>{name}</text>
        <text x={px + 76} y={y + 58} fontFamily={FONTS.sans} fontSize="17" fill={color}>{sub}</text>
      </g>
    );
  };
  const cut = frame >= 120;
  const c = L.card;
  const fold = tween(frame, 120, DUR.slow, 0, 1);
  const ci = L.cardInner;
  const Tc = { cx: c.x + c.w / 2, cy: c.y + ci.miniCy, s: ci.miniS };
  // Staged end-position visual for the share card, not an engine position (every third piece dropped).
  const finalPieces = piecesOf(SCRIPT.states[16]!).filter((_, i) => i % 3 !== 0);
  return (
    <SceneFrame layout={layout} id="s6">
      <Squares T={T} />
      <Rails T={T} />
      <Meridians T={T} />
      {sprites ? <Pieces T={T} pieces={pieces} sprites={sprites} /> : null}
      {sprites && mover ? <Sprite sprites={sprites} piece={{ rank: 0, file: 0, seat: mover.seat, kind: mover.kind }} at={mover.at} size={34 * T.s} scale={1.08} /> : null}
      {plaque(L.plaques.north, "Alex (you)", "North · to move", SEAT_COLOR[1], false, 0)}
      {plaque(L.plaques.east, "Practice bot", "East · calm, legal, fast", SEAT_COLOR[2], true, 8)}
      {plaque(L.plaques.south, "Practice bot", "South · your partner", SEAT_COLOR[3], true, 16)}
      {plaque(L.plaques.west, "Practice bot", "West", SEAT_COLOR[4], true, 24)}
      {cut ? (
        <g transform={`translate(${c.x + c.w / 2} ${c.y + c.h / 2}) scale(1 ${fold}) translate(${-c.x - c.w / 2} ${-c.y - c.h / 2})`}>
          <rect x={c.x} y={c.y} width={c.w} height={c.h} rx="22" fill={PALETTE.surface} stroke={PALETTE.line} strokeWidth="2" />
          <text x={c.x + 32} y={c.y + 50} fontFamily={FONTS.mono} fontSize="15" fill={PALETTE.textDim} letterSpacing="2">NERDS’ TABLE · GAME 14</text>
          <text x={c.x + 32} y={c.y + 92} fontFamily={FONTS.sans} fontSize="34" fontWeight="600" fill={PALETTE.text}>North &amp; South win</text>
          <text x={c.x + 32} y={c.y + 124} fontFamily={FONTS.sans} fontSize="19" fill={PALETTE.textDim}>checkmate on move 61 · 9 days</text>
          <Squares T={Tc} />
          <Rails T={Tc} />
          <Meridians T={Tc} width={2.5} />
          {sprites ? <Pieces T={Tc} pieces={finalPieces} sprites={sprites} /> : null}
          <rect x={c.x + 32} y={c.y + ci.urlY} width={c.w - 64} height="44" rx="22" fill={PALETTE.surfaceRaised} stroke={PALETTE.line} />
          <text x={c.x + c.w / 2} y={c.y + ci.urlY + 28} fontFamily={FONTS.mono} fontSize="18" fill={PALETTE.text} textAnchor="middle">roto-chess.vercel.app/replay/2HPMK</text>
          <Chip x={c.x + 32} y={c.y + ci.chipsY} w={150} h={44} label="Well played · 3" color={SEAT_COLOR[4]} size={18} opacity={fade(frame, 140, DUR.fast)} />
          <Chip x={c.x + 198} y={c.y + ci.chipsY} w={130} h={44} label="Rematch?" color={SEAT_COLOR[3]} size={18} opacity={fade(frame, 145, DUR.fast)} />
          <Chip x={c.x + 344} y={c.y + ci.chipsY} w={164} h={44} label="Watch replay" color={PALETTE.text} size={18} opacity={fade(frame, 150, DUR.fast)} />
        </g>
      ) : null}
      {cut ? (
        <g transform={`translate(0 ${tween(frame, 160, DUR.base, 30, 0)})`} opacity={fade(frame, 160, DUR.base)}>
          <rect x={c.x - 40} y={c.y + c.h + 30} width="300" height="48" rx="24" fill={PALETTE.surfaceRaised} />
          <text x={c.x - 20} y={c.y + c.h + 61} fontFamily={FONTS.sans} fontSize="18" fill={PALETTE.textDim}>Sam: that bishop at move 40…</text>
        </g>
      ) : null}
      <LowerThird text="Play when no one is waiting. Share when it ends." enterAt={30} layout={layout} id="s6" />
    </SceneFrame>
  );
};
