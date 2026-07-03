"use client";

/**
 * DemoBoard — a small interactive annulus for the rules page, powered by
 * the REAL engine (the cheapest correctness win in the plan): tap a piece
 * of the demo's active seat and its true legal moves light up. Read-only —
 * nothing applies.
 */
import { useState } from "react";
import {
  legalMovesFrom,
  type BoardState,
  type Move,
  type Square,
} from "@rotochess/engine";
import { RotoBoard } from "./RotoBoard";

/** Square id is rank * 4 + file (ranks 0–31). */
const rankOf = (sq: Square): number => sq >> 2;

/** Does this move's path cross the 32↔1 seam? Adjacent stops on a legal
 * path are never more than two ranks apart, so a jump of >16 ranks can
 * only be the short way round — through the seam. */
function crossesSeam(move: Move): boolean {
  const stops = [move.from, ...move.path];
  for (let i = 0; i + 1 < stops.length; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (a !== undefined && b !== undefined && Math.abs(rankOf(a) - rankOf(b)) > 16) {
      return true;
    }
  }
  return false;
}

/**
 * The most instructive move to preview: the captions promise "it wraps
 * through the seam", so prefer a seam-crossing path, then the longest —
 * never just whatever the engine happened to generate first.
 */
function bestPreview(moves: readonly Move[]): Move | null {
  let best: Move | null = null;
  let bestScore = -1;
  for (const move of moves) {
    const score = (crossesSeam(move) ? 1000 : 0) + move.path.length;
    if (score > bestScore) {
      best = move;
      bestScore = score;
    }
  }
  return best;
}

export function DemoBoard({
  state,
  caption,
  className,
}: {
  state: BoardState;
  caption?: string;
  className?: string;
}) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [preview, setPreview] = useState<Move | null>(null);
  const moves = selected !== null ? legalMovesFrom(state, selected) : [];

  return (
    <figure className={className}>
      <RotoBoard
        state={state}
        orientation={1}
        selected={selected}
        legalTargets={moves}
        pendingMove={preview ?? bestPreview(moves)}
        interactive
        onSquareTap={(sq) => {
          // Tapping a highlighted destination previews THAT move — the
          // piece stays selected so the tour can continue.
          if (selected !== null && sq !== selected) {
            const candidates = moves.filter((m) => m.to === sq);
            if (candidates.length > 0) {
              setPreview(bestPreview(candidates));
              return;
            }
          }
          setSelected((prev) =>
            prev === sq
              ? null
              : state.board[sq] && state.board[sq]?.seat === state.activeSeat
                ? sq
                : null,
          );
          setPreview(null);
        }}
        className="w-full"
        // Demos sit in prose grids/columns — never outgrow them.
        grow={false}
      />
      {caption && (
        <figcaption
          className="pt-2 text-center text-xs text-[color:var(--ink-dim)]"
          style={{ fontFamily: "var(--font-instrument-sans)" }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
