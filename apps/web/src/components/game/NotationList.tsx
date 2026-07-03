"use client";

/**
 * NotationList — round-grouped history, one row per round, four cells in
 * seat colors, special marks inline (* † ^ per Roto-PGN). Tap a turn to
 * jump the replay there (wired by the parent).
 */

import { useMemo } from "react";
import {
  SEAT_COMPASS,
  initialState,
  turnToToken,
  type Seat,
  type Turn,
} from "@rotochess/engine";

const SEAT_TEXT: Record<Seat, string> = {
  1: "text-[color:var(--north-red-bright)]",
  2: "text-[color:var(--east-black-bright)]",
  3: "text-[color:var(--south-blue-bright)]",
  4: "text-[color:var(--west-gold-bright)]",
};

export interface NotationListProps {
  turns: readonly Turn[];
  currentPly?: number;
  onJump?: (ply: number) => void;
}

export function NotationList({ turns, currentPly, onJump }: NotationListProps) {
  const tokens = useMemo(() => {
    let state = initialState();
    return turns.map((turn) => {
      const { token, after } = turnToToken(state, turn);
      const seat = state.activeSeat;
      state = after;
      return { token, seat };
    });
  }, [turns]);

  const rounds = useMemo(() => {
    const out: Array<typeof tokens> = [];
    for (let i = 0; i < tokens.length; i += 4) out.push(tokens.slice(i, i + 4));
    return out;
  }, [tokens]);

  if (tokens.length === 0) {
    return (
      <p className="p-3 text-sm text-text-dim">
        The board is set. No moves yet.
      </p>
    );
  }

  return (
    <ol
      className="space-y-1 p-2 text-sm"
      style={{ fontFamily: "var(--font-plex-mono)" }}
      aria-label="Move history"
    >
      {rounds.map((round, r) => (
        <li key={r} className="flex flex-wrap items-baseline gap-x-3">
          <span className="w-6 text-right text-text-dim">{r + 1}.</span>
          {round.map((entry, i) => {
            const ply = r * 4 + i + 1;
            // Compass letter is a VISIBLE prefix — seat identity is never
            // carried by color alone.
            const text = `${SEAT_COMPASS[entry.seat]}·${entry.token}`;
            return onJump ? (
              <button
                key={i}
                type="button"
                onClick={() => onJump(ply)}
                className={`${SEAT_TEXT[entry.seat]} ${
                  currentPly === ply ? "underline" : ""
                } hover:underline`}
              >
                {text}
              </button>
            ) : (
              <span key={i} className={SEAT_TEXT[entry.seat]}>
                {text}
              </span>
            );
          })}
        </li>
      ))}
    </ol>
  );
}
