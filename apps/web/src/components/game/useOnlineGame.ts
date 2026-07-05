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
  submitError: string | null;
  draws: { threefold: boolean; fiftyMove: boolean };
  turnsCount: number;
  actions: ActionRowView[];
  lastMoveAt: string | null;
  myUserId: string | null;
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
  last_move_at: string | null;
}

export interface ActionRowView {
  user_id: string;
  kind: string;
  ply_at: number;
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
  const [actions, setActions] = useState<ActionRowView[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const plyRef = useRef<number>(-1);

  const state = useMemo(() => {
    if (!row?.state) return null;
    try {
      return deserializeState(JSON.stringify(row.state));
    } catch {
      return null;
    }
  }, [row?.state]);

  const submitInFlightRef = useRef(false);
  const pendingRefetchRef = useRef(false);

  const refetch = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!supabase) return;
      // While our own submit is in flight, a doorbell refetch can read the
      // DB BEFORE our commit lands and roll the optimistic state back —
      // visible flicker. Defer non-forced refetches until the submit ends.
      if (submitInFlightRef.current && !opts?.force) {
        pendingRefetchRef.current = true;
        return;
      }
      const { data: game, error: gErr } = await supabase
        .from("games")
        .select(
          "id, table_id, join_code, status, state, current_ply, active_seat, result, result_reason, last_move_at",
        )
        .eq("id", gameId)
        .single();
      if (gErr || !game) {
        // Row genuinely absent (or not visible) → not-found. A transport
        // hiccup keeps the last good snapshot and stays quiet — the next
        // doorbell or focus refetch heals it.
        if (gErr?.code === "PGRST116" || !gErr) {
          setError(
            "This game could not be found (or you're not at its table).",
          );
        }
        setLoading(false);
        return;
      }
      setError(null);
      const { data: players } = await supabase
        .from("game_players")
        .select("seat, user_id, profiles(display_name)")
        .eq("game_id", gameId);
      const { data: actionRows } = await supabase
        .from("game_actions")
        .select("user_id, kind, ply_at")
        .eq("game_id", gameId)
        .order("created_at");
      setActions((actionRows ?? []) as ActionRowView[]);
      const fresh = game as unknown as GameRow;
      // Snapshot moved under a staged/selected interaction → the staging is
      // meaningless against the new position: clear it.
      if (plyRef.current !== -1 && fresh.current_ply !== plyRef.current) {
        setStagedFirst(null);
        setSelected(null);
        setPending([]);
        setPendingChoice(null);
      }
      setRow(fresh);
      plyRef.current = fresh.current_ply;
      setSeats(
        ((players ?? []) as unknown as Array<{
          seat: number;
          user_id: string;
          profiles: { display_name: string | null } | null;
        }>)
          .map((p) => ({
            seat: p.seat as Seat,
            userId: p.user_id,
            displayName: p.profiles?.display_name ?? "Player",
            ready: false,
          }))
          .sort((a, b) => a.seat - b.seat),
      );
      setLoading(false);
    },
    [supabase, gameId],
  );

  // Identity
  useEffect(() => {
    if (!supabase) {
      setError("Server play is not configured (demo mode).");
      setLoading(false);
      return;
    }
    // Persisted session (cookies), so the player's identity survives navigation
    // and focus changes without a flaky network re-validation.
    void supabase.auth.getSession().then(({ data }) => {
      setMyUserId(data.session?.user?.id ?? null);
    });
  }, [supabase]);

  // Doorbell subscription + focus/visibility healing (a dropped realtime
  // message must never leave the client stale forever).
  useEffect(() => {
    if (!supabase) return;
    const channel = subscribeToGame(supabase, gameId, {
      onMove: () => void refetch(),
      onGameUpdate: () => void refetch(),
      onSeatChange: () => void refetch(),
      onSubscribed: () => void refetch(),
    });
    const heal = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", heal);
    window.addEventListener("focus", heal);
    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", heal);
      window.removeEventListener("focus", heal);
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
    if (!state || !pendingChoice || !myTurn || submitInFlightRef.current) {
      return;
    }
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
    // Optimistic apply — including terminal status, so a mating move never
    // shows "X is thinking…" while the doorbell catches up.
    const turn: Turn = { submoves: submoves as unknown as Turn["submoves"] };
    const applied = applyTurn(state, turn);
    if (!applied.ok) {
      clearInteraction();
      return;
    }
    const optimisticStatus = evaluateStatus(applied.state);
    const terminal = optimisticStatus.kind !== "active";
    const touched: Square[] = submoves.flatMap((m) => [m.from, m.to]);
    setSubmitInFlight(true);
    submitInFlightRef.current = true;
    setSubmitError(null);
    setRow((prev) =>
      prev
        ? {
            ...prev,
            state: JSON.parse(JSON.stringify(applied.state)) as unknown,
            current_ply: prev.current_ply + 1,
            active_seat: terminal ? null : applied.state.activeSeat,
            status: terminal ? "complete" : prev.status,
            result: terminal
              ? optimisticStatus.kind === "checkmate"
                ? optimisticStatus.winningTeam === 1
                  ? "team_13"
                  : "team_24"
                : "draw"
              : prev.result,
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
          setSubmitError("The move didn't go through — board updated.");
          setLastMoveSquares([]);
        }
      })
      .catch(() => {
        setSubmitError("The table wobbled. Setting it right…");
        setLastMoveSquares([]);
      })
      .finally(() => {
        setSubmitInFlight(false);
        submitInFlightRef.current = false;
        pendingRefetchRef.current = false;
        // One forced refetch reconciles truth either way (commit or 409).
        void refetch({ force: true });
      });
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
    submitError,
    draws,
    turnsCount: row?.current_ply ?? 0,
    actions,
    lastMoveAt: row?.last_move_at ?? null,
    myUserId,
    tap,
    choosePending: setPendingChoice,
    confirm,
    cancelPending,
    unstage,
    refetch,
  };
}
