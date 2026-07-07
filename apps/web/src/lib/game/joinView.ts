/**
 * What a /join/{code} visitor may do, derived from the preview. Seats are
 * claimable only while the game is forming; watching is offered while it is
 * forming OR live; anything else is a stale code.
 */
import type { Seat } from "@rotochess/engine";

export interface JoinViewState {
  openSeats: Seat[];
  canSpectate: boolean;
  stale: boolean;
}

export function joinView(
  status: string | null,
  takenSeats: number[],
): JoinViewState {
  if (status === "lobby") {
    return {
      openSeats: ([1, 2, 3, 4] as const).filter(
        (s) => !takenSeats.includes(s),
      ),
      canSpectate: true,
      stale: false,
    };
  }
  if (status === "active") {
    return { openSeats: [], canSpectate: true, stale: false };
  }
  return { openSeats: [], canSpectate: false, stale: true };
}
