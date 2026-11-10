/**
 * Beat 2 (210–420, local 0–210): the camera pulls back (0–48) from the hero
 * board to the board-in-a-browser; chrome fades in (24–36); sidebar panels
 * fade (36–48); the mail badge pings at 120 (11 s); a veil dims the window
 * with the type at 150.
 */
import { useCurrentFrame } from "remotion";
import { Meridians, Numerals, Pieces, Rails, Squares } from "../board/Board";
import { useSprites } from "../board/sprites";
import { SCRIPT, piecesOf } from "../board/script";
import { OUTER_R } from "../board/geometry";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { DUR, fade, tween } from "../motion";
import { PALETTE, SEAT_COLOR } from "../theme";
import { LowerThird } from "../ui/LowerThird";
import { SceneFrame } from "./SceneFrame";

const HISTORY = ["1. P B2→B3 · P B31→B29", "2. P B7→B5 · P B10→B11", "3. P B15→B13 · P B18→B19", "4. P B23→B21 · P B26→B27", "5. P C2→C3 · P B29→B28", "6. P B5→B4 · P C10→C11", "7. P B13→B12 · P C18→C19", "8. P B21→B20 · P C26→C27"];
const CHAT = ["North: nice curl", "East: that pawn is doomed", "South: back tomorrow", "West: (observing) hi all"];

export const Scene2Today = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const sprites = useSprites();
  const from = layout.hero;
  const to = layout.today;
  const k = tween(frame, 0, 1600, 0, 1);
  const T = { cx: from.cx + (to.cx - from.cx) * k, cy: from.cy + (to.cy - from.cy) * k, s: from.s + (to.s - from.s) * k };
  const win = layout.today.win;
  const chrome = fade(frame, 24, DUR.slow);
  const panels = fade(frame, 36, DUR.slow);
  const ping = frame >= 120 && frame < 132 ? 1 + 0.25 * Math.sin(((frame - 120) / 12) * Math.PI) : 1;
  const veil = 0.18 * fade(frame, 150, DUR.slow);
  const pieces = piecesOf(SCRIPT.states[8]!);
  const grey = { frame: "#1d1d1f", bar: "#2a2a2d", field: "#333337", text: "#c8c8cc", dim: "#9a9aa0" };
  const hist = layout.today.history;
  const chat = layout.today.chat;
  const histPitch = (hist.h - 90) / HISTORY.length;
  const chatPitch = (chat.h - 150) / CHAT.length;
  const plaques: [number, number, string, string, "start" | "middle" | "end"][] = [
    [T.cx, T.cy - OUTER_R * T.s - 34, "North · Alex", SEAT_COLOR[1], "middle"],
    [T.cx + OUTER_R * T.s + 24, T.cy, "East · Sam", SEAT_COLOR[2], "start"],
    [T.cx, T.cy + OUTER_R * T.s + 50, "South · Jordan", SEAT_COLOR[3], "middle"],
    [T.cx - OUTER_R * T.s - 24, T.cy, "West · Casey", SEAT_COLOR[4], "end"],
  ];
  return (
    <SceneFrame layout={layout} id="s2">
      <g opacity={chrome}>
        <rect x={win.x} y={win.y} width={win.w} height={win.h} rx="14" fill={grey.frame} stroke="#3a3a3c" strokeWidth="2" />
        <rect x={win.x} y={win.y} width={win.w} height="52" rx="14" fill={grey.bar} />
        <rect x={win.x} y={win.y + 30} width={win.w} height="22" fill={grey.bar} />
        {[30, 54, 78].map((dx) => <circle key={dx} cx={win.x + dx} cy={win.y + 26} r="7" fill="#5c5c60" />)}
        <rect x={win.x + 120} y={win.y + 8} width="260" height="38" rx="8" fill="#3a3a3e" />
        <text x={win.x + 140} y={win.y + 33} fontFamily={FONTS.sans} fontSize="19" fill={grey.text}>Roto Chess · Game</text>
        <rect x={win.x} y={win.y + 52} width={win.w} height="54" fill="#232326" />
        <rect x={win.x + 120} y={win.y + 62} width={win.w - 240} height="34" rx="17" fill={grey.field} />
        <text x={win.x + 148} y={win.y + 85} fontFamily={FONTS.mono} fontSize="19" fill={grey.dim}>roto-chess.vercel.app/app/game/2HPMK</text>
        <rect x={win.x + 2} y={win.y + 106} width={win.w - 4} height={win.h - 108} fill={PALETTE.bg} />
      </g>
      <Squares T={T} />
      <Rails T={T} />
      <Meridians T={T} />
      {sprites ? <Pieces T={T} pieces={pieces} sprites={sprites} /> : null}
      <g opacity={chrome}><Numerals T={T} /></g>
      <g opacity={panels}>
        {plaques.map(([x, y, label, color, anchor]) => (
          <text key={label} x={x} y={y} fontFamily={FONTS.sans} fontSize="19" fill={color} textAnchor={anchor}>{label}</text>
        ))}
        <rect x={hist.x} y={hist.y} width={hist.w} height={hist.h} rx="8" fill={PALETTE.surface} stroke={PALETTE.line} />
        <text x={hist.x + 20} y={hist.y + 36} fontFamily={FONTS.mono} fontSize="15" fill={PALETTE.textDim} letterSpacing="2">HISTORY</text>
        {HISTORY.map((row, i) => (
          <text key={row} x={hist.x + 20} y={hist.y + 72 + i * histPitch} fontFamily={FONTS.mono} fontSize="18" fill={i === HISTORY.length - 1 ? PALETTE.text : PALETTE.textDim}>{row}</text>
        ))}
        <rect x={chat.x} y={chat.y} width={chat.w} height={chat.h} rx="8" fill={PALETTE.surface} stroke={PALETTE.line} />
        <text x={chat.x + 20} y={chat.y + 36} fontFamily={FONTS.mono} fontSize="15" fill={PALETTE.textDim} letterSpacing="2">TABLE CHAT</text>
        {CHAT.map((row, i) => (
          <text key={row} x={chat.x + 20} y={chat.y + 72 + i * chatPitch} fontFamily={FONTS.sans} fontSize="19" fill={PALETTE.textDim}>{row}</text>
        ))}
        <rect x={chat.x + 16} y={chat.y + chat.h - 60} width={chat.w - 32} height="40" rx="20" fill={PALETTE.surfaceRaised} stroke={PALETTE.line} />
        <text x={chat.x + 36} y={chat.y + chat.h - 34} fontFamily={FONTS.sans} fontSize="18" fill="#6f6555">Say something…</text>
        <g transform={`translate(${win.x + win.w - 145} ${win.y + 20}) scale(${ping})`} opacity="0.7">
          <rect width="110" height="26" rx="13" fill={PALETTE.surfaceRaised} stroke={PALETTE.line} />
          <text x="55" y="18" fontFamily={FONTS.mono} fontSize="14" fill={PALETTE.textDim} textAnchor="middle" letterSpacing="1">MAIL · 1</text>
        </g>
      </g>
      <rect x={win.x} y={win.y} width={win.w} height={win.h} rx="14" fill={PALETTE.bg} opacity={veil} />
      <LowerThird text="It works. It does not yet feel alive." enterAt={150} layout={layout} id="s2" />
    </SceneFrame>
  );
};
