"use client";

/**
 * "Check" said out loud, in words, for players and observers alike — the
 * king's square already ripples and a cue sounds, but neither names WHO is
 * in check. §6.3 rides along: a check on a player who is not to move is not
 * yet decided.
 */
import type { Seat } from "@rotochess/engine";

export function CheckBanner({
  inCheck,
  activeSeat,
  nameOf,
}: {
  inCheck: readonly Seat[];
  activeSeat: Seat;
  /** The seat's on-screen name (player name online, colour in hotseat). */
  nameOf: (seat: Seat) => string;
}) {
  if (inCheck.length === 0) return null;
  const who = inCheck.map((s) => `${nameOf(s)}'s king`).join(" and ");
  const undecided = inCheck.some((s) => s !== activeSeat);
  return (
    <p
      role="status"
      data-testid="check-banner"
      className="mb-2 text-center text-sm text-text"
    >
      <span className="mr-2 inline-block rounded-full border border-[color:var(--check)] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-[color:var(--check)]">
        Check
      </span>
      {who} {inCheck.length > 1 ? "are" : "is"} in check
      {undecided && (
        <span className="text-text-dim">
          {" "}
          — not checkmate unless it stands on their turn
        </span>
      )}
      .
    </p>
  );
}
