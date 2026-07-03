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
  hitTest,
  movePathD,
  polarPoint,
  rotationForSeat,
  snapToTargets,
} from "./board-geometry";

const SEAT_BRIGHT: Record<Seat, string> = {
  1: "var(--north-red-bright)",
  2: "var(--east-black-bright)",
  3: "var(--south-blue-bright)",
  4: "var(--west-gold-bright)",
};

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
  /** Play the setting-the-board ceremony on mount (meridians draw, armies settle). */
  ceremony?: boolean;
  /** Squares whose pieces just earned a halo — the gold ring blooms once. */
  bloomSquares?: readonly Square[];
  /** Squares where a piece just evaporated — ash motes rise once. */
  evaporateSquares?: readonly Square[];
  /**
   * The crown is taken: the board's ONE slow rotation brings the winning
   * team's quadrants to the vertical axis; everything else dims; a gold arc
   * inscribes the rim.
   */
  ceremonyWinner?: 1 | 2 | null;
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
  ceremony = false,
  bloomSquares = [],
  evaporateSquares = [],
  ceremonyWinner = null,
}: RotoBoardProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  // The checkmate ceremony overrides the seat rotation: the winning team's
  // meridian axis comes to vertical. Team 1 = N/S → 0°; team 2 = E/W → 90°.
  const rotation =
    ceremonyWinner !== null
      ? ceremonyWinner === 1
        ? 0
        : 90
      : rotationForSeat(orientation);
  const bloomSet = useMemo(() => new Set(bloomSquares), [bloomSquares]);
  const evaporateSet = useMemo(
    () => new Set(evaporateSquares),
    [evaporateSquares],
  );

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
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) * VIEWBOX) / rect.width;
      const y = ((e.clientY - rect.top) * VIEWBOX) / rect.height;
      const square =
        selected !== null && targetSquares.size > 0
          ? snapToTargets(
              x,
              y,
              rotation,
              targetSquares,
              (sq) => state.board[sq]?.seat === state.activeSeat,
            )
          : hitTest(x, y, rotation);
      if (square !== null) onSquareTap(square);
    },
    [interactive, onSquareTap, rotation, selected, targetSquares, state],
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
      <g
        transform={`rotate(${rotation} ${CENTER} ${CENTER})`}
        className={ceremonyWinner !== null ? "ceremony-rotation" : undefined}
        style={
          ceremonyWinner !== null
            ? { transform: `rotate(${rotation}deg)`, transformOrigin: "center" }
            : undefined
        }
      >
        {SQUARES.map((g) => (
          <path
            key={g.square}
            d={g.path}
            // Canonical parity (verified square-by-square against Figure 1):
            // internal parity 0 (e.g. 1A) is CREAM, parity 1 is umber.
            fill={g.color === 0 ? "var(--board-cream)" : "var(--board-umber)"}
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
              fill="var(--last-move)"
              fillOpacity={0.3}
              stroke="none"
            />
          ) : null,
        )}
        {/* Meridians — always drawn on top of the cells */}
        {MERIDIAN_LINES.map((m, i) => (
          <line
            key={m.seat}
            x1={m.x1}
            y1={m.y1}
            x2={m.x2}
            y2={m.y2}
            stroke="var(--board-meridian)"
            strokeWidth={m.seat === orientation ? 4 : 2.5}
            strokeLinecap="round"
            className={ceremony ? "ceremony-meridian" : undefined}
            style={ceremony ? { animationDelay: `${i * 80}ms` } : undefined}
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
          <>
            <defs>
              <marker
                id="path-arrow"
                viewBox="0 0 8 8"
                refX="6"
                refY="4"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" fill={SEAT_BRIGHT[state.activeSeat]} />
              </marker>
            </defs>
            <path
              d={movePathD(pendingMove.from, pendingMove.path)}
              fill="none"
              stroke={SEAT_BRIGHT[state.activeSeat]}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeDasharray="1 8"
              opacity={0.95}
              markerEnd="url(#path-arrow)"
            />
            {/* Ghost of the mover at its destination (60%) — the clearest
                "this is where it lands" signal on small cells. */}
            {(() => {
              const mover = state.board[pendingMove.from];
              const g = SQUARES[pendingMove.to];
              if (!mover || !g) return null;
              return (
                <g
                  transform={`rotate(${-rotation} ${g.cx} ${g.cy})`}
                  opacity={0.6}
                >
                  <image
                    href={`/pieces/${mover.seat}${pendingMove.promotion ?? mover.kind}.svg`}
                    x={g.cx - PIECE_SIZE / 2}
                    y={g.cy - PIECE_SIZE / 2}
                    width={PIECE_SIZE}
                    height={PIECE_SIZE}
                  />
                </g>
              );
            })()}
          </>
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
          const winnerDim =
            ceremonyWinner !== null &&
            (((piece.seat - 1) % 2) + 1) !== ceremonyWinner;
          return (
            <g
              key={`p-${g.square}`}
              transform={`rotate(${-rotation} ${g.cx} ${g.cy})`}
              className={
                winnerDim
                  ? "ceremony-dim"
                  : ceremony
                    ? "ceremony-piece"
                    : undefined
              }
              style={
                ceremony
                  ? { animationDelay: `${(piece.seat - 1) * 120 + 500}ms` }
                  : undefined
              }
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
                  className={
                    bloomSet.has(g.square) ? "halo-bloom" : undefined
                  }
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
                  r={3}
                  fill="var(--piece-cream-detail)"
                  stroke="var(--piece-outline)"
                  strokeWidth={0.6}
                />
              )}
            </g>
          );
        })}
        {/* Evaporation motes: three ash flecks rising from the square */}
        {[...evaporateSet].map((sq) => {
          const g = SQUARES[sq];
          if (!g) return null;
          return (
            <g key={`evap-${sq}`}>
              {[-6, 0, 6].map((dx, i) => (
                <circle
                  key={i}
                  cx={g.cx + dx}
                  cy={g.cy - i * 3}
                  r={2}
                  fill="var(--evaporate)"
                  className="evaporate-mote"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
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
            fontSize={10.5}
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
        const r = active ? 13 : 9;
        // East's form identity (never hue alone): the dot-in-ring variant.
        const eastRing = seat === 2;
        return (
          <g key={`dot-${seat}`}>
            {eastRing ? (
              <>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill="var(--bg)"
                  stroke={SEAT_BRIGHT[seat]}
                  strokeWidth={1.5}
                  opacity={active ? 1 : 0.55}
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r - 3}
                  fill={SEAT_BRIGHT[seat]}
                  opacity={active ? 1 : 0.55}
                />
              </>
            ) : (
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={SEAT_BRIGHT[seat]}
                opacity={active ? 1 : 0.55}
              />
            )}
            <text
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={active ? 13 : 9}
              fontWeight={700}
              fill="var(--bg)"
              style={{ fontFamily: "var(--font-plex-mono)" }}
            >
              {SEAT_COMPASS[seat]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
