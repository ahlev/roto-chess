import type { PieceKind, Seat } from "@rotochess/engine";
import { LACQUER, PALETTE } from "../theme";

/** Provisional 2.5D silhouettes (base at y=0). Replaced by the v5 3D pieces in the follow-on plan. */
const SHAPES: Record<PieceKind, string> = {
  P: "M-13 0 L13 0 L11 -6 L5 -10 L5 -22 Q10 -26 10 -32 Q10 -41 0 -41 Q-10 -41 -10 -32 Q-10 -26 -5 -22 L-5 -10 L-11 -6 Z",
  R: "M-14 0 L14 0 L12 -7 L8 -11 L8 -40 L13 -40 L13 -52 L7 -52 L7 -46 L3 -46 L3 -52 L-3 -52 L-3 -46 L-7 -46 L-7 -52 L-13 -52 L-13 -40 L-8 -40 L-8 -11 L-12 -7 Z",
  N: "M-14 0 L14 0 L12 -7 L7 -11 L7 -24 L15 -34 L20 -42 L18 -48 L8 -54 L4 -64 L-2 -56 L-10 -54 L-17 -44 L-15 -36 L-5 -32 L-7 -24 L-7 -11 L-12 -7 Z",
  B: "M-14 0 L14 0 L12 -7 L6 -11 L6 -22 Q12 -28 12 -40 Q12 -54 0 -60 Q-12 -54 -12 -40 Q-12 -28 -6 -22 L-6 -11 L-12 -7 Z M0 -60 L0 -66",
  Q: "M-15 0 L15 0 L13 -7 L7 -12 L7 -30 Q14 -38 14 -52 L10 -66 L5 -58 L0 -68 L-5 -58 L-10 -66 L-14 -52 Q-14 -38 -7 -30 L-7 -12 L-13 -7 Z",
  K: "M-15 0 L15 0 L13 -7 L7 -12 L7 -32 Q14 -40 14 -54 L0 -64 L-14 -54 Q-14 -40 -7 -32 L-7 -12 L-13 -7 Z M0 -64 L0 -80 M-6 -73 L6 -73",
};

export const Staunton = ({ x, y, seat, kind, h = 1, opacity = 1 }: { x: number; y: number; seat: Seat; kind: PieceKind; h?: number; opacity?: number }) => (
  <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${h.toFixed(3)})`} opacity={opacity}>
    <ellipse cx="0" cy="2" rx="16" ry="5" fill="#000" opacity="0.35" />
    <path d={SHAPES[kind]} fill={LACQUER[seat]} stroke={PALETTE.pieceBlack} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
  </g>
);
