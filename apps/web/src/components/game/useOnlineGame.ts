"use client";

/**
 * Networked game state — same interaction machine as hotseat, but the
 * authority is the server: submit via POST /api/games/[id]/turn with
 * optimistic apply and rollback-on-reject; remote turns arrive through the
 * realtime doorbell with ply reconciliation (apply-or-refetch).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applySubmove,
  applyTurn,
  claimableDraws,
  deserializeState,
  evaluateStatus,
  inOpening,
  legalMoves,
  legalSecondSubmoves,
  type BoardState,
  type Move,
  type Seat,
  type Square,
  type Turn,
} from "@rotochess/engine";
import { browserClient } from "@/lib/supabase/client";
import { subscribeToGame } from "@/lib/game/realtime";

export interface SeatInfo {
  seat: Seat;
  userId: string;
  displayName: string;
  ready: boolean;
}

export interface OnlineGame {
  loading: boolean;
  error: string | null;
  gameId: string;
  tableId: string | null;
  joinCode: string | null;
  gameStatus: "lobby" | "active" | "complete" | "abandoned" | "dormant";
  result: string | null;
  resultReason: string | null;
  seats: SeatInfo[];
  /** The viewer's seat, or null (spectator). */
  mySeat: Seat | null;
  state: BoardState | null;
  displayState: BoardState | null;
  stagedFirst: Move | null;
  selected: Square | null;
  selectionMoves: readonly Move[];
  pending: readonly Move[];
  pendingChoice: Move | null;
  lastMoveSquares: readonly Square[];
  submitInFlight: boolean;
  draws: { threefold: boolean; fiftyMove: boolean };
  turnsCount: number;
  tap: (square: Square) => void;
  choosePending: (m: Move) => void;
  confirm: () => void;
  cancelPending: () => void;
  unstage: () => void;
  refetch: () => Promise<void>;
}

interface GameRow {
  id: string;
  table_id: string;
  join_code: string;
  status: OnlineGame["gameStatus"];
  state: unknown;
  current_ply: number;
  active_seat: number | null;
  result: string | null;
  result_reason: string | null;
}

export function useOnlineGame(gameId: string): OnlineGame {
  const supabase = browserClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<GameRow | null>(null);
  const [seats, setSeats] = useState<SeatInfo[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [stagedFirst, setStagedFirst] = useState<Move | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [pending, setPending] = useState<readonly Move[]>([]);
  const [pendingChoice, setPendingChoice] = useState<Move | null>(null);
  const [lastMoveSquares, setLastMoveSquares] = useState<readonly Square[]>([]);
  const [submitInFlight, setSubmitInFlight] = useState(false);
  const plyRef = useRef<number>(-1);

  const state = useMemo(() => {
    if (!row?.state) return null;
    try {
      return deserializeState(JSON.stringify(row.state));
    } catch {
      return null;
    }
  }, [row?.state]);

  const refetch = useCallback(async () => {
    if (!supabase) return;
    const { data: game, error: gErr } = await supabase
      .from("games")
      .select(
        "id, table_id, join_code, status, state, current_ply, active_seat, result, result_reason",
      )
      .eq("id", gameId)
      .single();
    if (gErr || !game) {
      setError("This game could not be found (or you're not at its table).");
      setLoading(false);
      return;
    }
    const { data: players } = await supabase
      .from("game_players")
      .select("seat, user_id, ready, profiles(display_name)")
      .eq("game_id", gameId);
    setRow(game as unknown as GameRow);
    plyRef.current = (game as { current_ply: number }).current_ply;
    setSeats(
      ((players ?? []) as unknown as Array<{
        seat: number;
        user_id: string;
        ready: boolean;
        profiles: { display_name: string | null } | null;
      }>)
        .map((p) => ({
          seat: p.seat as Seat,
          userId: p.user_id,
          displayName: p.profiles?.display_name ?? "Player",
          ready: p.ready,
        }))
        .sort((a, b) => a.seat - b.seat),
    );
    setLoading(false);
  }, [supabase, gameId]);

  // Identity
  useEffect(() => {
    if (!supabase) {
      setError("Server play is not configured (demo mode).");
      setLoading(false);
      return;
    }
    void supabase.auth.getUser().then(({ data }) => {
      setMyUserId(data.user?.id ?? null);
    });
  }, [supabase]);

  // Doorbell subscription
  useEffect(() => {
    if (!supabase) return;
    const channel = subscribeToGame(supabase, gameId, {
      onMove: () => void refetch(),
      onGameUpdate: () => void refetch(),
      onSeatChange: () => void refetch(),
      onSubscribed: () => void refetch(),
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, gameId, refetch]);

  const mySeat = useMemo<Seat | null>(() => {
    const mine = seats.find((s) => s.userId === myUserId);
    return mine?.seat ?? null;
  }, [seats, myUserId]);

  const myTurn =
    state !== null &&
    row?.status === "active" &&
    mySeat !== null &&
    state.activeSeat === mySeat;

  const displayState = useMemo(
    () => (state && stagedFirst ? applySubmove(state, stagedFirst) : state),
    [state, stagedFirst],
  );

  const availableMoves = useMemo(() => {
    if (!state || !myTurn) return [] as Move[];
    if (stagedFirst) return legalSecondSubmoves(state, stagedFirst);
    return legalMoves(state);
  }, [state, myTurn, stagedFirst]);

  const selectionMoves = useMemo(
    () =>
      selected === null
        ? []
        : availableMoves.filter((m) => m.from === selected),
    [availableMoves, selected],
  );

  const clearInteraction = useCallback(() => {
    setSelected(null);
    setPending([]);
    setPendingChoice(null);
    setStagedFirst(null);
  }, []);

  const tap = useCallback(
    (square: Square) => {
      if (!myTurn || submitInFlight) return;
      if (selected !== null) {
        const candidates = selectionMoves.filter((m) => m.to === square);
        if (candidates.length > 0) {
          setPending(candidates);
          setPendingChoice(candidates[0] ?? null);
          return;
        }
      }
      if (square === selected) {
        setSelected(null);
        setPending([]);
        setPendingChoice(null);
        return;
      }
      if (availableMoves.some((m) => m.from === square)) {
        setSelected(square);
        setPending([]);
        setPendingChoice(null);
        return;
      }
      setSelected(null);
      setPending([]);
      setPendingChoice(null);
    },
    [availableMoves, myTurn, selected, selectionMoves, submitInFlight],
  );

  const confirm = useCallback(() => {
    if (!state || !pendingChoice || !myTurn) return;
    if (inOpening(state) && !stagedFirst) {
      setStagedFirst(pendingChoice);
      setPending([]);
      setPendingChoice(null);
      setSelected(null);
      return;
    }
    const submoves: Move[] = stagedFirst
      ? [stagedFirst, pendingChoice]
      : [pendingChoice];
    const refBody = {
      submoves: submoves.map((m) => ({
        from: m.from,
        to: m.to,
        ...(m.promotion ? { promotion: m.promotion } : {}),
        ...(m.rotDir ? { rotDir: m.rotDir } : {}),
      })),
    };
    // Optimistic apply:
    const turn: Turn = { submoves: submoves as unknown as Turn["submoves"] };
    const applied = applyTurn(state, turn);
    if (!applied.ok) {
      clearInteraction();
      return;
    }
    const touched: Square[] = submoves.flatMap((m) => [m.from, m.to]);
    setSubmitInFlight(true);
    setRow((prev) =>
      prev
        ? {
            ...prev,
            state: JSON.parse(JSON.stringify(applied.state)) as unknown,
            current_ply: prev.current_ply + 1,
            active_seat: applied.state.activeSeat,
          }
        : prev,
    );
    setLastMoveSquares(touched);
    clearInteraction();

    void fetch(`/api/games/${gameId}/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(refBody),
    })
      .then(async (res) => {
        if (!res.ok) {
          // Rejected (race or bug): roll back by refetching truth.
          await refetch();
        }
      })
      .catch(() => refetch())
      .finally(() => setSubmitInFlight(false));
  }, [
    state,
    pendingChoice,
    myTurn,
    stagedFirst,
    gameId,
    refetch,
    clearInteraction,
  ]);

  const cancelPending = useCallback(() => {
    setPending([]);
    setPendingChoice(null);
  }, []);

  const unstage = useCallback(() => {
    setStagedFirst(null);
    cancelPending();
    setSelected(null);
  }, [cancelPending]);

  const draws = useMemo(
    () =>
      state ? claimableDraws(state) : { threefold: false, fiftyMove: false },
    [state],
  );

  // Status double-check for display (the server already recorded terminal
  // states; this keeps the client honest if it applied optimistically).
  useMemo(() => (state ? evaluateStatus(state) : null), [state]);

  return {
    loading,
    error,
    gameId,
    tableId: row?.table_id ?? null,
    joinCode: row?.join_code ?? null,
    gameStatus: row?.status ?? "lobby",
    result: row?.result ?? null,
    resultReason: row?.result_reason ?? null,
    seats,
    mySeat,
    state,
    displayState,
    stagedFirst,
    selected,
    selectionMoves,
    pending,
    pendingChoice,
    lastMoveSquares,
    submitInFlight,
    draws,
    turnsCount: row?.current_ply ?? 0,
    tap,
    choosePending: setPendingChoice,
    confirm,
    cancelPending,
    unstage,
    refetch,
  };
}
