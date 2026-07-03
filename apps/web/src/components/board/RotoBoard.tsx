"use client";

/**
 * RotoBoard — the interactive annulus. One pointer listener + polar
 * hit-testing (never per-<path> handlers), legal-move snap, per-seat
 * rotation with pieces and numerals counter-rotated upright, halo
 * circlets, check pulse, move paths, and turn-order dots in the center.
 * Pieces render from the baked static sprites in /public/pieces.
 */

import { useCallback, useMemo, useRef } from "react";
import {
  SEAT_COMPASS,
  isInCheck,
  kingSquare,
  type BoardState,
  type Move,
  type Seat,
  type Square,
} from "@rotochess/engine";
import {
  CENTER,
  INNER_R,
  MERIDIAN_LINES,
  NUMERAL_ANCHORS,
  SQUARES,
  VIEWBOX,
  distSq,
  hitTest,
  movePathD,
  polarPoint,
  rotationForSeat,
} from "./board-geometry";

const SEAT_BRIGHT: Record<Seat, string> = {
  1: "var(--north-red-bright)",
  2: "var(--east-black-bright)",
  3: "var(--south-blue-bright)",
  4: "var(--west-gold-bright)",
};

/** Snap radius in viewBox units (~22pt at a 351pt render of a 680 viewBox). */
const SNAP_RADIUS = 42;
const PIECE_SIZE = 34;

export interface RotoBoardProps {
  state: BoardState;
  /** Board orientation: this seat's meridian sits at 6 o'clock. */
  orientation: Seat;
  selected?: Square | null;
  /** Legal moves for the selection (engine-filtered). */
  legalTargets?: readonly Move[];
  /** The move pending confirmation — its path is drawn. */
  pendingMove?: Move | null;
  /** Squares of the last completed turn, tinted until the next move. */
  lastMove?: readonly Square[];
  interactive?: boolean;
  onSquareTap?: (square: Square) => void;
  className?: string;
}

export function RotoBoard({
  state,
  orientation,
  selected = null,
  legalTargets = [],
  pendingMove = null,
  lastMove = [],
  interactive = true,
  onSquareTap,
  className,
}: RotoBoardProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rotation = rotationForSeat(orientation);

  const targetSquares = useMemo(
    () => new Set(legalTargets.map((m) => m.to)),
    [legalTargets],
  );
  const captureSquares = useMemo(
    () =>
      new Set(
        legalTargets.filter((m) => m.captures !== undefined).map((m) => m.to),
      ),
    [legalTargets],
  );
  const lastMoveSet = useMemo(() => new Set(lastMove), [lastMove]);

  const checkedKings = useMemo(() => {
    const out: Square[] = [];
    for (const seat of [1, 2, 3, 4] as const) {
      try {
        if (isInCheck(state, seat)) out.push(kingSquare(state, seat));
      } catch {
        // fixture states without a king — render without check marks
      }
    }
    return out;
  }, [state]);

  const handlePointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!interactive || !onSquareTap || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scale = VIEWBOX / rect.width;
      const x = (e.clientX - rect.left) * scale;
      const y = (e.clientY - rect.top) * scale;
      let square = hitTest(x, y, rotation);
      // Legal-move snap (UX layer 2): a near-miss within SNAP_RADIUS of a
      // legal destination's centroid snaps to it.
      if (selected !== null && targetSquares.size > 0) {
        const rad = (-rotation * Math.PI) / 180;
        const rx =
          CENTER + (x - CENTER) * Math.cos(rad) - (y - CENTER) * Math.sin(rad);
        const ry =
          CENTER + (x - CENTER) * Math.sin(rad) + (y - CENTER) * Math.cos(rad);
        let best: { sq: Square; d: number } | null = null;
        for (const t of targetSquares) {
          const g = SQUARES[t];
          if (!g) continue;
          const d = distSq(rx, ry, g.cx, g.cy);
          if (d <= SNAP_RADIUS * SNAP_RADIUS && (!best || d < best.d)) {
            best = { sq: t, d };
          }
        }
        if (best && (square === null || !targetSquares.has(square))) {
          square = best.sq;
        }
      }
      if (square !== null) onSquareTap(square);
    },
    [interactive, onSquareTap, rotation, selected, targetSquares],
  );

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      className={className}
      role="group"
      aria-label="Roto Chess board"
      onPointerDown={handlePointer}
      style={{ touchAction: "manipulation", userSelect: "none" }}
    >
      <g transform={`rotate(${rotation} ${CENTER} ${CENTER})`}>
        {SQUARES.map((g) => (
          <path
            key={g.square}
            d={g.path}
            fill={g.color === 1 ? "var(--board-cream)" : "var(--board-umber)"}
            stroke="var(--line)"
            strokeWidth={0.6}
          />
        ))}
        {selected !== null && SQUARES[selected] && (
          <path
            d={SQUARES[selected].path}
            fill={SEAT_BRIGHT[state.activeSeat]}
            fillOpacity={0.4}
            stroke={SEAT_BRIGHT[state.activeSeat]}
            strokeWidth={2}
          />
        )}
        {[...lastMoveSet].map((sq) =>
          SQUARES[sq] ? (
            <path
              key={`last-${sq}`}
              d={SQUARES[sq].path}
              fill="var(--halo)"
              fillOpacity={0.14}
              stroke="none"
            />
          ) : null,
        )}
        {/* Meridians — always drawn on top of the cells */}
        {MERIDIAN_LINES.map((m) => (
          <line
            key={m.seat}
            x1={m.x1}
            y1={m.y1}
            x2={m.x2}
            y2={m.y2}
            stroke="var(--board-meridian)"
            strokeWidth={m.seat === orientation ? 4 : 2.5}
            strokeLinecap="round"
          />
        ))}
        {checkedKings.map((sq) =>
          SQUARES[sq] ? (
            <path
              key={`check-${sq}`}
              d={SQUARES[sq].path}
              fill="none"
              stroke="var(--check)"
              strokeWidth={3}
              className="animate-pulse"
            />
          ) : null,
        )}
        {pendingMove && (
          <path
            d={movePathD(pendingMove.from, pendingMove.path)}
            fill="none"
            stroke={SEAT_BRIGHT[state.activeSeat]}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeDasharray="1 8"
            opacity={0.95}
          />
        )}
        {selected !== null &&
          [...targetSquares].map((sq) => {
            const g = SQUARES[sq];
            if (!g) return null;
            return captureSquares.has(sq) ? (
              <path
                key={`t-${sq}`}
                d={g.path}
                fill="none"
                stroke={SEAT_BRIGHT[state.activeSeat]}
                strokeWidth={2.5}
                opacity={0.9}
              />
            ) : (
              <circle
                key={`t-${sq}`}
                cx={g.cx}
                cy={g.cy}
                r={6}
                fill={SEAT_BRIGHT[state.activeSeat]}
                opacity={0.7}
              />
            );
          })}
        {/* Pieces — counter-rotated upright; halo circlets; blue base notch */}
        {SQUARES.map((g) => {
          const piece = state.board[g.square];
          if (!piece) return null;
          return (
            <g
              key={`p-${g.square}`}
              transform={`rotate(${-rotation} ${g.cx} ${g.cy})`}
            >
              {piece.halo && (
                <circle
                  cx={g.cx}
                  cy={g.cy}
                  r={PIECE_SIZE / 2 - 1}
                  fill="none"
                  stroke="var(--halo)"
                  strokeWidth={1.6}
                  opacity={0.95}
                />
              )}
              <image
                href={`/pieces/${piece.seat}${piece.kind}.svg`}
                x={g.cx - PIECE_SIZE / 2}
                y={g.cy - PIECE_SIZE / 2}
                width={PIECE_SIZE}
                height={PIECE_SIZE}
              />
              {piece.seat === 3 && (
                <circle
                  cx={g.cx}
                  cy={g.cy + PIECE_SIZE / 2 - 4}
                  r={1.8}
                  fill="var(--piece-cream-detail)"
                />
              )}
            </g>
          );
        })}
        {/* Rank numerals inside the center hole — absolute, upright */}
        {NUMERAL_ANCHORS.map((n) => (
          <text
            key={n.display}
            x={n.x}
            y={n.y}
            transform={`rotate(${-rotation} ${n.x} ${n.y})`}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9}
            fill="var(--text-dim)"
            style={{ fontFamily: "var(--font-plex-mono)" }}
          >
            {n.display}
          </text>
        ))}
      </g>
      {/* Turn-order dots at the meridian angles (screen-fixed, inside numerals) */}
      {([1, 2, 3, 4] as const).map((seat) => {
        const p = polarPoint(
          (((seat - 1) * 90 + rotation) % 360 + 360) % 360,
          INNER_R - 30,
        );
        const active = state.activeSeat === seat;
        return (
          <g key={`dot-${seat}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r={active ? 8 : 5}
              fill={SEAT_BRIGHT[seat]}
              opacity={active ? 1 : 0.55}
            />
            <text
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={active ? 8 : 6}
              fontWeight={700}
              fill="var(--bg)"
            >
              {SEAT_COMPASS[seat]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
