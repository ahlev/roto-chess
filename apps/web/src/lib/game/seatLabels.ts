/**
 * How a seat is NAMED on screen. The compass words (North/East/South/West)
 * stay in the rulebook and the notation; at the table a seat is its colour,
 * and a seated player is their name (or first initial where space is tight).
 */
import type { Seat } from "@rotochess/engine";

/** The seat's colour, as a proper name: "Red to move", "Gold's rook". */
export const SEAT_COLOR_NAME: Record<Seat, string> = {
  1: "Red",
  2: "Black",
  3: "Blue",
  4: "Gold",
};

/** Seat 3's view: North (seat 1, who always moves first) sits at the top. */
export const LOCKED_ORIENTATION: Seat = 3;

/** First initial of a display name, uppercased ("mike h" → "M"). */
export function initialOf(name: string): string {
  const first = [...name.trim()][0];
  return first ? first.toUpperCase() : "";
}

/**
 * One short label per seat for tight spots (turn dots, the notation list):
 * the seated player's first initial, or the turn-order number when the seat
 * has no named player (hotseat, an unfilled lobby).
 */
export function seatShortLabels(
  seats: ReadonlyArray<{ seat: Seat; displayName: string }>,
): Record<Seat, string> {
  const out: Record<Seat, string> = { 1: "1", 2: "2", 3: "3", 4: "4" };
  for (const s of seats) {
    const initial = initialOf(s.displayName);
    if (initial) out[s.seat] = initial;
  }
  return out;
}

/** The seated player's name, falling back to the seat's colour. */
export function seatDisplayName(
  seats: ReadonlyArray<{ seat: Seat; displayName: string }>,
  seat: Seat,
): string {
  const name = seats.find((s) => s.seat === seat)?.displayName.trim();
  return name || SEAT_COLOR_NAME[seat];
}
