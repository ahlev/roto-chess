"use client";

/**
 * "It's your turn" notifications for the header bell. Mirrors the dashboard's
 * refresh idiom (load on mount, heal on focus/visibility, poll every 60s) so
 * the two never disagree, and tracks which turns have been *seen* so the badge
 * clears once the player opens the bell — then re-raises when a new move lands
 * (each turn changes the game's last_move_at, which is part of the signature).
 */
import { useCallback, useEffect, useState } from "react";
import type { Seat } from "@rotochess/engine";
import { browserClient } from "@/lib/supabase/client";

export interface TurnNotification {
  gameId: string;
  tableName: string;
  /** ISO timestamp of the last move — also the freshness key. */
  lastMoveAt: string | null;
}

const SEEN_KEY = "rc-turn-seen";

/** Stable per-turn signature: a new move (new last_move_at) re-raises it. */
export function turnSignature(n: TurnNotification): string {
  return `${n.gameId}:${n.lastMoveAt ?? "0"}`;
}

/** How many listed turns haven't been acknowledged (in the seen set) yet. */
export function countUnseen(
  items: readonly TurnNotification[],
  seen: ReadonlySet<string>,
): number {
  return items.reduce((n, it) => n + (seen.has(turnSignature(it)) ? 0 : 1), 0);
}

/** Drop stale signatures so the persisted seen set can't grow unbounded. */
export function pruneSeen(
  prev: ReadonlySet<string>,
  items: readonly TurnNotification[],
): Set<string> {
  const live = new Set(items.map(turnSignature));
  return new Set([...prev].filter((s) => live.has(s)));
}

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export interface TurnNotificationsState {
  items: readonly TurnNotification[];
  /** Count not yet acknowledged by opening the bell. */
  unseen: number;
  /** Mark everything currently listed as seen (call when the panel opens). */
  markSeen: () => void;
}

export function useTurnNotifications(): TurnNotificationsState {
  const supabase = browserClient();
  const [items, setItems] = useState<readonly TurnNotification[]>([]);
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen());

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      setItems([]);
      return;
    }
    const { data } = await supabase
      .from("game_players")
      .select("seat, games!inner(id, status, active_seat, last_move_at, tables(name))")
      .eq("user_id", user.id);
    const rows = (data ?? []) as unknown as Array<{
      seat: number;
      games: {
        id: string;
        status: string;
        active_seat: number | null;
        last_move_at: string | null;
        tables: { name: string } | null;
      };
    }>;
    const mine = rows
      .filter(
        (r) =>
          r.games.status === "active" &&
          r.games.active_seat === (r.seat as Seat),
      )
      .map((r) => ({
        gameId: r.games.id,
        tableName: r.games.tables?.name ?? "A table",
        lastMoveAt: r.games.last_move_at,
      }))
      // Oldest wait first — the turn you've kept people waiting on longest.
      .sort((a, b) => (a.lastMoveAt ?? "").localeCompare(b.lastMoveAt ?? ""));
    setItems(mine);

    // Prune the seen set to only live signatures so it can't grow unbounded.
    setSeen((prev) => {
      const next = pruneSeen(prev, mine);
      if (next.size !== prev.size && typeof window !== "undefined") {
        window.localStorage.setItem(SEEN_KEY, JSON.stringify([...next]));
      }
      return next;
    });
  }, [supabase]);

  useEffect(() => {
    void load();
    const heal = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", heal);
    window.addEventListener("focus", heal);
    const interval = window.setInterval(heal, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", heal);
      window.removeEventListener("focus", heal);
      window.clearInterval(interval);
    };
  }, [load]);

  const markSeen = useCallback(() => {
    setSeen(() => {
      const next = new Set(items.map(turnSignature));
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SEEN_KEY, JSON.stringify([...next]));
      }
      return next;
    });
  }, [items]);

  return { items, unseen: countUnseen(items, seen), markSeen };
}
