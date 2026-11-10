/**
 * Beat 4 (local 0–240): the browser ghost fades (0–18); the board shrinks
 * and flies along a gold path into the home-screen icon (18–51), which
 * lands with a 150 ms settle; the banner slides down at 135 (26.5 s); the
 * tap ring pulses at 165–180. Type enters at 60.
 */
import { useCurrentFrame } from "remotion";
import { Meridians, Squares } from "../board/Board";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { DUR, fade, tween } from "../motion";
import { PALETTE, SEAT_COLOR } from "../theme";
import { Chip } from "../ui/Chip";
import { Rose } from "../ui/Rose";
import { LowerThird } from "../ui/LowerThird";
import { SceneFrame } from "./SceneFrame";

const TONES = ["#2e2a24", "#33302b", "#3a3327", "#2b2f2a", "#332a2a", "#2a2e33"];

export const Scene4Pocket = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const ph = layout.pocket.phone;
  const screen = { x: ph.x + 16, y: ph.y + 16, w: ph.w - 32, h: ph.h - 32 };
  const ix = screen.x + 34, iy = screen.y + 200, cell = 100;
  const hero = { x: ix + cell, y: iy + cell };
  const ghost = 0.35 * (1 - fade(frame, 0, 600));
  const flight = tween(frame, 18, 1100, 0, 1);
  const start = layout.pocket.miniStart;
  // Quadratic flight: start → control → icon center.
  const c = { x: (start.cx + hero.x + 36) / 2 + 60, y: Math.min(start.cy, hero.y) - 120 };
  const u = flight;
  const fx = (1 - u) * (1 - u) * start.cx + 2 * (1 - u) * u * c.x + u * u * (hero.x + 36);
  const fy = (1 - u) * (1 - u) * start.cy + 2 * (1 - u) * u * c.y + u * u * (hero.y + 36);
  const fs = start.s + (0.11 - start.s) * u;
  const landed = frame >= 51;
  const iconScale = landed ? tween(frame, 51, DUR.fast, 1.12, 1) : 0;
  const banner = tween(frame, 135, DUR.base, -140, 0);
  const bannerOpacity = fade(frame, 135, DUR.base);
  const tap = frame >= 165 && frame < 180 ? Math.sin(((frame - 165) / 15) * Math.PI) : 0;
  const tapFade = 1 - tween(frame, 180, DUR.slow, 0, 1);
  const nb = { x: screen.x + 18, y: screen.y + 74 + banner, w: screen.w - 36, h: 112 };
  const win = layout.today.win;
  const copy = layout.pocket.copy;
  return (
    <SceneFrame layout={layout} id="s4">
      <g opacity={ghost}>
        <rect x={win.x + 120} y={win.y + 20} width={win.w - 320} height={win.h - 60} rx="14" fill="none" stroke="#5a5a60" strokeWidth="2" strokeDasharray="6 10" />
        <text x={win.x + 260} y={win.y + 55} fontFamily={FONTS.mono} fontSize="19" fill="#8a8a90">roto-chess.vercel.app</text>
      </g>
      <rect x={ph.x} y={ph.y} width={ph.w} height={ph.h} rx="64" fill="#0b0907" stroke={PALETTE.line} strokeWidth="3" />
      <rect x={screen.x} y={screen.y} width={screen.w} height={screen.h} rx="50" fill={PALETTE.surface} />
      <rect x={ph.x + ph.w / 2 - 60} y={screen.y + 14} width="120" height="28" rx="14" fill="#0b0907" />
      <text x={screen.x + 36} y={screen.y + 50} fontFamily={FONTS.sans} fontSize="22" fontWeight="600" fill={PALETTE.text}>9:41</text>
      {Array.from({ length: 20 }, (_, n) => {
        const r = Math.floor(n / 4), col = n % 4;
        const x = ix + col * cell, y = iy + r * cell;
        if (r === 1 && col === 1) {
          return (
            <g key={n} transform={`translate(${x + 36} ${y + 36}) scale(${iconScale}) translate(${-x - 36} ${-y - 36})`}>
              <rect x={x} y={y} width="72" height="72" rx="18" fill={PALETTE.bg} stroke={SEAT_COLOR[4]} strokeWidth="3" />
              <Rose x={x + 12} y={y + 12} size={48} />
              <text x={x + 36} y={y + 94} fontFamily={FONTS.sans} fontSize="15" fontWeight="500" fill={PALETTE.text} textAnchor="middle">Roto Chess</text>
            </g>
          );
        }
        return (
          <g key={n}>
            <rect x={x} y={y} width="72" height="72" rx="18" fill={TONES[n % TONES.length]} />
            <rect x={x + 22} y={y + 84} width="28" height="6" rx="3" fill={PALETTE.line} />
          </g>
        );
      })}
      <rect x={screen.x + 24} y={screen.y + screen.h - 120} width={screen.w - 48} height="96" rx="28" fill={PALETTE.surfaceRaised} opacity="0.8" />
      {[0, 1, 2, 3].map((col) => <rect key={col} x={screen.x + 48 + col * 96} y={screen.y + screen.h - 108} width="72" height="72" rx="18" fill={TONES[(col + 2) % TONES.length]} />)}
      {!landed ? (
        <g>
          <path d={`M ${start.cx} ${start.cy} Q ${c.x} ${c.y} ${hero.x + 36} ${hero.y + 36}`} fill="none" stroke={SEAT_COLOR[4]} strokeWidth="2.5" strokeDasharray="3 12" strokeLinecap="round" opacity={0.8 * fade(frame, 10, DUR.base)} />
          <g opacity="0.9">
            <Squares T={{ cx: fx, cy: fy, s: fs }} />
            <Meridians T={{ cx: fx, cy: fy, s: fs }} width={2.5} />
          </g>
        </g>
      ) : null}
      <g opacity={bannerOpacity}>
        <rect x={nb.x} y={nb.y} width={nb.w} height={nb.h} rx="26" fill={PALETTE.surfaceRaised} stroke={PALETTE.line} strokeWidth="1.5" />
        <rect x={nb.x + 16} y={nb.y + 18} width="56" height="56" rx="14" fill={PALETTE.bg} stroke={SEAT_COLOR[4]} strokeWidth="2" />
        <Rose x={nb.x + 20} y={nb.y + 22} size={48} />
        <text x={nb.x + 88} y={nb.y + 36} fontFamily={FONTS.mono} fontSize="15" fill={PALETTE.textDim} letterSpacing="1">ROTO CHESS · now</text>
        <text x={nb.x + 88} y={nb.y + 64} fontFamily={FONTS.sans} fontSize="21" fontWeight="600" fill={PALETTE.text}>Your move at the Nerds’ table</text>
        <text x={nb.x + 88} y={nb.y + 92} fontFamily={FONTS.sans} fontSize="18" fill={PALETTE.textDim}>Jordan’s knight gave check on D13.</text>
        <circle cx={nb.x + 44} cy={nb.y + 46} r={26 + 10 * tap} fill="none" stroke={SEAT_COLOR[4]} strokeWidth="2" opacity={0.7 * (1 - tap * 0.6) * tapFade} />
        <circle cx={nb.x + 44} cy={nb.y + 46} r="10" fill={SEAT_COLOR[4]} opacity={0.8 * tapFade} />
      </g>
      <g opacity={fade(frame, 40, DUR.slow)}>
        <Chip x={copy.x} y={copy.y} w={360} h={50} label="Add to Home Screen" color={SEAT_COLOR[4]} size={22} />
        <text x={copy.x} y={copy.y + 90} fontFamily={FONTS.sans} fontSize="22" fill={PALETTE.textDim}>Manifest · icon set · offline shell</text>
        <text x={copy.x} y={copy.y + 126} fontFamily={FONTS.sans} fontSize="22" fill={PALETTE.textDim}>Web Push on Android and iPhone</text>
      </g>
      <LowerThird text="Then, make it yours." enterAt={60} layout={layout} id="s4" />
    </SceneFrame>
  );
};
