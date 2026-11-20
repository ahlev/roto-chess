"use client";

/**
 * The last three turns, written out under the board — who moved and what
 * they played, newest last — so a player returning to the table can read the
 * run of play without opening the full History. Display notation (spec §3.1);
 * the canonical long form rides on the title tooltip.
 */
import { useMemo } from "react";
import {
  initialState,
  turnToDisplay,
  type Seat,
  type Turn,
} from "@rotochess/engine";
import { SEAT_CHIP } from "@/components/game/SeatPlaques";

const SHOWN = 3;

export function RecentMovesStrip({
  turns,
  nameOf,
}: {
  turns: readonly Turn[];
  /** The seat's on-screen name (player name online, colour in hotseat). */
  nameOf: (seat: Seat) => string;
}) {
  const recent = useMemo(() => {
    let state = initialState();
    const all = turns.map((turn, i) => {
      const seat = state.activeSeat;
      const { display, canonical, after } = turnToDisplay(state, turn);
      state = after;
      return { seat, display, canonical, round: Math.floor(i / 4) + 1, ply: i };
    });
    return all.slice(-SHOWN);
  }, [turns]);

  if (recent.length === 0) return null;

  return (
    <ol
      aria-label="Last three moves"
      data-testid="recent-moves"
      className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-text-dim"
    >
      <li className="text-[10px] uppercase tracking-wide">Last moves</li>
      {recent.map((m, i) => (
        <li
          key={m.ply}
          title={m.canonical}
          className={`flex items-center gap-1.5 ${
            i === recent.length - 1 ? "text-text" : ""
          }`}
        >
          <span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-full ${SEAT_CHIP[m.seat]}`}
          />
          <span className="max-w-24 truncate">{nameOf(m.seat)}</span>
          <span style={{ fontFamily: "var(--font-plex-mono)" }}>
            {m.display}
          </span>
        </li>
      ))}
    </ol>
  );
}
