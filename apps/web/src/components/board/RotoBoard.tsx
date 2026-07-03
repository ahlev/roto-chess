"use client";

/**
 * RotoBoard — the interactive annulus. One pointer listener + polar
 * hit-testing (never per-<path> handlers), legal-move snap, per-seat
 * rotation with pieces and numerals counter-rotated upright, halo
 * circlets, check ripple, move paths, and turn-order dots in the center.
 * Pieces render from the baked static sprites in /public/pieces.
 *
 * Keyboard driving (a11y): the wrapper takes focus; arrow keys walk a
 * cursor square around the ring, Enter/Space activates it through the SAME
 * onSquareTap path as a pointer tap, Escape clears the selection, and a
 * visually-hidden polite live region narrates the cursor and results.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import {
  FILE_COUNT,
  SEAT_COMPASS,
  fileOf,
  formatSquare,
  isInCheck,
  kingSquare,
  rankOf,
  squareOf,
  type BoardState,
  type Move,
  type Piece,
  type PieceKind,
  type Seat,
  type Square,
} from "@rotochess/engine";
import {
  CENTER,
  INNER_R,
  MERIDIAN_LINES,
  NUMERAL_ANCHORS,
  OUTER_R,
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

/** Spoken color per seat (matches the seat accent tokens). */
const SEAT_COLOR: Record<Seat, string> = {
  1: "red",
  2: "black",
  3: "blue",
  4: "gold",
};

const KIND_NAME: Record<PieceKind, string> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
  P: "pawn",
};

const PIECE_SIZE = 34;

/** Standard visually-hidden style for the live region (screen readers only). */
const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

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
  /** Squares whose pieces just earned a halo — the gold ring inscribes once. */
  bloomSquares?: readonly Square[];
  /** Squares where a piece just evaporated — it dissolves to ash, motes rise. */
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
  // Consequence flags per destination: any candidate move that evaporates
  // the mover or earns it a halo marks the square (engine-authored flags).
  const targetEffects = useMemo(() => {
    const out = new Map<Square, { evaporates: boolean; earnsHalo: boolean }>();
    for (const mv of legalTargets) {
      const e = out.get(mv.to) ?? { evaporates: false, earnsHalo: false };
      if (mv.evaporates) e.evaporates = true;
      if (mv.earnsHalo) e.earnsHalo = true;
      out.set(mv.to, e);
    }
    return out;
  }, [legalTargets]);
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

  // --- Keyboard cursor + screen-reader announcements (a11y) ---------------
  const [cursor, setCursor] = useState<Square | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const describeSquare = useCallback(
    (sq: Square) => {
      const piece = state.board[sq];
      return piece
        ? `${formatSquare(sq)} — ${SEAT_COLOR[piece.seat]} ${KIND_NAME[piece.kind]}${piece.halo ? ", haloed" : ""}`
        : `${formatSquare(sq)} — empty`;
    },
    [state],
  );

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
      if (square !== null) {
        setCursor(square); // keep the keyboard cursor in sync with taps
        onSquareTap(square);
      }
    },
    [interactive, onSquareTap, rotation, selected, targetSquares, state],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!interactive) return;
      if (e.key === "Escape") {
        if (selected !== null && onSquareTap) {
          // Tapping the selected square deselects — same path as a pointer tap.
          onSquareTap(selected);
          setAnnouncement("Selection cleared");
        }
        e.preventDefault();
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        if (cursor !== null && onSquareTap) onSquareTap(cursor);
        e.preventDefault();
        return;
      }
      if (!e.key.startsWith("Arrow")) return;
      e.preventDefault();
      // The first arrow press reveals the cursor near the viewer's own back
      // rank. After that: Right = visually clockwise (seat rotation never
      // mirrors the board, so rank+1 is always clockwise on screen);
      // Up = inward toward file A, Down = outward toward D, clamped —
      // matching screen direction in the viewer's own quadrant at 6 o'clock.
      const base =
        cursor ?? selected ?? squareOf((orientation - 1) * 8, FILE_COUNT - 1);
      let rank = rankOf(base);
      let file = fileOf(base);
      if (cursor !== null) {
        if (e.key === "ArrowRight") rank += 1;
        else if (e.key === "ArrowLeft") rank -= 1;
        else if (e.key === "ArrowUp") file = Math.max(0, file - 1);
        else if (e.key === "ArrowDown")
          file = Math.min(FILE_COUNT - 1, file + 1);
      }
      const next = squareOf(rank, file); // squareOf wraps ranks mod 32
      setCursor(next);
      setAnnouncement(describeSquare(next));
    },
    [interactive, cursor, selected, onSquareTap, orientation, describeSquare],
  );

  // Announce selection results ("Knight selected, 5 destinations").
  const announcedSelectionRef = useRef(selected);
  useEffect(() => {
    if (selected === announcedSelectionRef.current) return;
    announcedSelectionRef.current = selected;
    if (selected === null) {
      setAnnouncement("Selection cleared");
      return;
    }
    const piece = state.board[selected];
    if (!piece) return;
    const kind = KIND_NAME[piece.kind];
    const n = targetSquares.size;
    setAnnouncement(
      `${kind.charAt(0).toUpperCase()}${kind.slice(1)} selected, ${n} destination${n === 1 ? "" : "s"}`,
    );
  }, [selected, state, targetSquares]);

  // Announce the pending destination…
  const announcedPendingRef = useRef(pendingMove);
  useEffect(() => {
    if (pendingMove === announcedPendingRef.current) return;
    announcedPendingRef.current = pendingMove;
    if (pendingMove) {
      setAnnouncement(
        `Destination ${formatSquare(pendingMove.to)} chosen — confirm to move`,
      );
    }
  }, [pendingMove]);

  // …and completed moves. (Declared after the selection effect so "Moved"
  // wins over "Selection cleared" when a confirm does both in one commit.)
  const lastMoveKey = lastMove.join(",");
  const announcedLastMoveRef = useRef(lastMoveKey);
  useEffect(() => {
    if (lastMoveKey === announcedLastMoveRef.current) return;
    announcedLastMoveRef.current = lastMoveKey;
    if (lastMoveKey !== "") setAnnouncement("Moved");
  }, [lastMoveKey]);

  // --- Evaporation ghosts --------------------------------------------------
  // The engine removes the doomed piece from `state` in the same commit that
  // `evaporateSquares` arrives, so remember the previous board and keep the
  // piece rendered for its ~550ms dissolve toward ash.
  const [ghosts, setGhosts] = useState<
    ReadonlyArray<{ square: Square; piece: Piece }>
  >([]);
  const prevBoardRef = useRef(state.board);
  const ghostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evapKey = evaporateSquares.join(",");
  const seenEvapKeyRef = useRef("");
  useEffect(() => {
    if (evapKey === seenEvapKeyRef.current) return;
    seenEvapKeyRef.current = evapKey;
    if (ghostTimerRef.current !== null) clearTimeout(ghostTimerRef.current);
    if (evaporateSquares.length === 0) {
      setGhosts([]);
      return;
    }
    const resolved: Array<{ square: Square; piece: Piece }> = [];
    for (const sq of evaporateSquares) {
      const piece = state.board[sq] ?? prevBoardRef.current[sq];
      if (piece) resolved.push({ square: sq, piece });
    }
    setGhosts(resolved);
    // Removal timing only: with reduced motion the CSS collapses the fade to
    // an instant, so nothing visible lingers during this window.
    ghostTimerRef.current = setTimeout(() => setGhosts([]), 600);
  }, [evapKey, evaporateSquares, state]);
  useEffect(() => {
    prevBoardRef.current = state.board;
  }, [state]);
  useEffect(
    () => () => {
      if (ghostTimerRef.current !== null) clearTimeout(ghostTimerRef.current);
    },
    [],
  );

  return (
    <div
      className="roto-board-wrap"
      role={interactive ? "application" : undefined}
      aria-label={interactive ? "Game board" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        className={className}
        role="group"
        aria-label="Roto Chess board"
        onPointerDown={handlePointer}
        style={{
          touchAction: "manipulation",
          userSelect: "none",
          display: "block",
        }}
      >
        <g
          transform={`rotate(${rotation} ${CENTER} ${CENTER})`}
          className={ceremonyWinner !== null ? "ceremony-rotation" : undefined}
          style={
            ceremonyWinner !== null
              ? {
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: "center",
                }
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
          {/* Check: static vermilion ring + a one-shot radial ripple that
              plays once when the check appears (keyed per square). */}
          {checkedKings.map((sq) => {
            const g = SQUARES[sq];
            if (!g) return null;
            return (
              <g key={`check-${sq}`}>
                <path
                  d={g.path}
                  fill="none"
                  stroke="var(--check)"
                  strokeWidth={3}
                />
                <circle
                  cx={g.cx}
                  cy={g.cy}
                  r={PIECE_SIZE / 2}
                  fill="none"
                  stroke="var(--check)"
                  strokeWidth={2.5}
                  className="check-ripple"
                />
              </g>
            );
          })}
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
                  <path
                    d="M 0 0 L 8 4 L 0 8 z"
                    fill={SEAT_BRIGHT[state.activeSeat]}
                  />
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
          {/* Destination markers — consequence-aware: an ash-teal dashed
              ring flags moves that evaporate the mover; a thin gold accent
              flags moves that earn a halo (form first, hue second). */}
          {selected !== null &&
            [...targetSquares].map((sq) => {
              const g = SQUARES[sq];
              if (!g) return null;
              const fx = targetEffects.get(sq);
              return (
                <g key={`t-${sq}`}>
                  {captureSquares.has(sq) ? (
                    <path
                      d={g.path}
                      fill="none"
                      stroke={SEAT_BRIGHT[state.activeSeat]}
                      strokeWidth={2.5}
                      opacity={0.9}
                    />
                  ) : (
                    <circle
                      cx={g.cx}
                      cy={g.cy}
                      r={fx?.evaporates ? 4.5 : 6}
                      fill={SEAT_BRIGHT[state.activeSeat]}
                      opacity={0.7}
                    />
                  )}
                  {fx?.evaporates && (
                    <circle
                      cx={g.cx}
                      cy={g.cy}
                      r={10}
                      fill="none"
                      stroke="var(--evaporate)"
                      strokeWidth={2.2}
                      strokeDasharray="3.5 2.6"
                      opacity={0.95}
                    />
                  )}
                  {fx?.earnsHalo && (
                    <circle
                      cx={g.cx}
                      cy={g.cy}
                      r={fx.evaporates ? 13.5 : 10.5}
                      fill="none"
                      stroke="var(--halo)"
                      strokeWidth={1.3}
                      opacity={0.9}
                    />
                  )}
                </g>
              );
            })}
          {/* Pieces — counter-rotated upright; halo circlets; blue base notch.
              The settle animation lives on an INNER group so its final
              transform can never override the counter-rotation attribute. */}
          {SQUARES.map((g) => {
            const piece = state.board[g.square];
            if (!piece) return null;
            const winnerDim =
              ceremonyWinner !== null &&
              ((piece.seat - 1) % 2) + 1 !== ceremonyWinner;
            return (
              <g
                key={`p-${g.square}`}
                transform={`rotate(${-rotation} ${g.cx} ${g.cy})`}
                className={winnerDim ? "ceremony-dim" : undefined}
              >
                <g
                  className={ceremony ? "ceremony-piece" : undefined}
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
                        bloomSet.has(g.square) ? "halo-inscribe" : undefined
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
              </g>
            );
          })}
          {/* Keyboard cursor — distinct from the selection highlight; shown
              only while the board has keyboard focus (CSS :focus-visible). */}
          {cursor !== null && SQUARES[cursor] && (
            <path
              d={SQUARES[cursor].path}
              fill="none"
              stroke="var(--focus-ring)"
              strokeWidth={2.6}
              strokeDasharray="6 4"
              className="board-cursor"
              pointerEvents="none"
            />
          )}
          {/* Evaporation: the doomed piece dissolves toward ash (~550ms)… */}
          {ghosts.map(({ square: sq, piece }) => {
            const g = SQUARES[sq];
            if (!g || state.board[sq]) return null;
            return (
              <g
                key={`ghost-${sq}`}
                transform={`rotate(${-rotation} ${g.cx} ${g.cy})`}
                className="evaporate-piece"
                pointerEvents="none"
              >
                <image
                  href={`/pieces/${piece.seat}${piece.kind}.svg`}
                  x={g.cx - PIECE_SIZE / 2}
                  y={g.cy - PIECE_SIZE / 2}
                  width={PIECE_SIZE}
                  height={PIECE_SIZE}
                />
                <circle
                  cx={g.cx}
                  cy={g.cy}
                  r={PIECE_SIZE / 2 - 3}
                  fill="var(--evaporate)"
                  className="evaporate-veil"
                />
              </g>
            );
          })}
          {/* …while nine ash motes rise (deterministic per-mote scatter,
              counter-rotated so they rise toward screen-up). */}
          {[...evaporateSet].map((sq) => {
            const g = SQUARES[sq];
            if (!g) return null;
            return (
              <g
                key={`evap-${sq}`}
                transform={`rotate(${-rotation} ${g.cx} ${g.cy})`}
              >
                {Array.from({ length: 9 }, (_, i) => (
                  <circle
                    key={i}
                    cx={g.cx + ((i % 3) - 1) * 7 + (((i * 5) % 3) - 1) * 2}
                    cy={g.cy + 4 - ((i * 7) % 11)}
                    r={1.4 + (i % 3) * 0.5}
                    fill="var(--evaporate)"
                    className="evaporate-mote"
                    style={{ animationDelay: `${120 + ((i * 3) % 5) * 55}ms` }}
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
        {/* The crown taken: a gold arc inscribes the outer rim. The CSS
            dasharray (1760) matches this circle: 2π·OUTER_R = 2π·280 ≈ 1759.3. */}
        {ceremonyWinner !== null && (
          <circle
            cx={CENTER}
            cy={CENTER}
            r={OUTER_R}
            fill="none"
            stroke="var(--halo)"
            strokeWidth={3}
            className="ceremony-rim"
          />
        )}
        {/* Turn-order dots at the meridian angles (screen-fixed, inside numerals) */}
        {([1, 2, 3, 4] as const).map((seat) => {
          const p = polarPoint(
            ((((seat - 1) * 90 + rotation) % 360) + 360) % 360,
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
      {/* Screen-reader narration: cursor position, selection results, moves. */}
      <div aria-live="polite" role="status" style={VISUALLY_HIDDEN}>
        {announcement}
      </div>
    </div>
  );
}
