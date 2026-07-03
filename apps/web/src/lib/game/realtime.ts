/**
 * Realtime is a DOORBELL, not a data bus. One channel per open game screen;
 * every payload carries ply; gap or stale → refetch snapshot and reconcile;
 * always refetch on (re)subscribe. The client stays correct even if
 * realtime delivers nothing at all.
 */
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export interface GameDoorbell {
  /** A move row landed (payload ply included). */
  onMove: (ply: number, turnJson: unknown) => void;
  /** The games row changed (status/active_seat/current_ply). */
  onGameUpdate: () => void;
  /** A seat filled (lobby). */
  onSeatChange: () => void;
  /** Fired on SUBSCRIBED — always refetch here. */
  onSubscribed: () => void;
}

export function subscribeToGame(
  supabase: SupabaseClient,
  gameId: string,
  bell: GameDoorbell,
): RealtimeChannel {
  const channel = supabase
    .channel(`game:${gameId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "moves",
        filter: `game_id=eq.${gameId}`,
      },
      (payload) => {
        const row = payload.new as { ply: number; turn: unknown };
        bell.onMove(row.ply, row.turn);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "games",
        filter: `id=eq.${gameId}`,
      },
      () => bell.onGameUpdate(),
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "game_players",
        filter: `game_id=eq.${gameId}`,
      },
      () => bell.onSeatChange(),
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "game_actions",
        filter: `game_id=eq.${gameId}`,
      },
      // Proposals/claims/nudges: same doorbell, same refetch.
      () => bell.onGameUpdate(),
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") bell.onSubscribed();
    });
  return channel;
}
