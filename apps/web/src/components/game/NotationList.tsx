"use client";

/**
 * NotationList — round-grouped history, one row per round, four cells in
 * seat colors, special marks inline (* † ^ per Roto-PGN). Moves render in
 * the abbreviated DISPLAY form (spec §3.1); the canonical long form rides
 * on the title tooltip. Tap a turn to jump the replay there (wired by the
 * parent).
 */

import { useMemo } from "react";
import {
  SEAT_COMPASS,
  initialState,
  turnToDisplay,
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
      const { display, canonical, after } = turnToDisplay(state, turn);
      const seat = state.activeSeat;
      state = after;
      return { display, canonical, seat };
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
      className="space-y-1 p-2 text-[11px] leading-tight sm:text-sm"
      style={{ fontFamily: "var(--font-plex-mono)" }}
      aria-label="Move history"
    >
      {rounds.map((round, r) => (
        <li
          key={r}
          className="flex flex-nowrap items-baseline gap-x-1.5 overflow-x-auto sm:flex-wrap sm:gap-x-3"
        >
          <span className="w-5 shrink-0 text-right text-text-dim sm:w-6">
            {r + 1}.
          </span>
          {round.map((entry, i) => {
            const ply = r * 4 + i + 1;
            // Compass letter is a VISIBLE prefix — seat identity is never
            // carried by color alone.
            const text = `${SEAT_COMPASS[entry.seat]}·${entry.display}`;
            return onJump ? (
              <button
                key={i}
                type="button"
                onClick={() => onJump(ply)}
                title={entry.canonical}
                className={`${SEAT_TEXT[entry.seat]} shrink-0 whitespace-nowrap ${
                  currentPly === ply ? "underline" : ""
                } hover:underline`}
              >
                {text}
              </button>
            ) : (
              <span
                key={i}
                title={entry.canonical}
                className={`${SEAT_TEXT[entry.seat]} shrink-0 whitespace-nowrap`}
              >
                {text}
              </span>
            );
          })}
        </li>
      ))}
    </ol>
  );
}
