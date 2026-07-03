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
  type Square,
} from "@rotochess/engine";
import { RotoBoard } from "./RotoBoard";

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
  const moves = selected !== null ? legalMovesFrom(state, selected) : [];

  return (
    <figure className={className}>
      <RotoBoard
        state={state}
        orientation={1}
        selected={selected}
        legalTargets={moves}
        pendingMove={
          selected !== null && moves.length > 0 ? (moves[0] ?? null) : null
        }
        interactive
        onSquareTap={(sq) => {
          setSelected((prev) =>
            prev === sq
              ? null
              : state.board[sq] && state.board[sq]?.seat === state.activeSeat
                ? sq
                : null,
          );
        }}
        className="w-full"
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
