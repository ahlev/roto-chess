/**
 * Observer (spectator) membership — table-scoped: an observer follows the
 * table's whole series until they stop watching or claim a seat.
 */
import type { Seat } from "@rotochess/engine";

export interface ObserverInfo {
  userId: string;
  displayName: string;
}

export type ViewerRole = "player" | "observer" | "none";

export function resolveViewerRole(
  mySeat: Seat | null,
  myUserId: string | null,
  observers: ObserverInfo[],
): ViewerRole {
  if (mySeat !== null) return "player";
  if (myUserId !== null && observers.some((o) => o.userId === myUserId)) {
    return "observer";
  }
  return "none";
}
