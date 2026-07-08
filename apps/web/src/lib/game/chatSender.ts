/**
 * Who is talking in chat: a seat (colored name), an observer (grey +
 * "(observing)"), or neither (a departed member — grey, unflagged). Judged
 * against the CURRENT seat map: someone who later claims a seat re-renders
 * seated (accepted V1 drift — see the design doc, assumption A5).
 */
import type { Seat } from "@rotochess/engine";
import type { ObserverInfo } from "@/lib/game/observers";

export interface ChatSender {
  seat: Seat | null;
  observing: boolean;
}

export function resolveSender(
  userId: string,
  seats: ReadonlyArray<{ seat: Seat; userId: string }>,
  observers: ReadonlyArray<ObserverInfo>,
): ChatSender {
  const seat = seats.find((s) => s.userId === userId)?.seat ?? null;
  if (seat !== null) return { seat, observing: false };
  return { seat: null, observing: observers.some((o) => o.userId === userId) };
}
