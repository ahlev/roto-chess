"use client";

/**
 * Hotseat game state — the interaction state machine from the UX spec:
 * idle → selected → destinationChosen → (confirm) → applied, with the
 * opening's two-submove staging (submove 1 confirmed = STAGED locally;
 * submove 2's confirm submits the whole atomic turn).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applySubmove,
  applyTurn,
  evaluateStatus,
  inOpening,
  initialState,
  legalMoves,
  legalMovesFrom,
  legalSecondSubmoves,
  claimableDraws,
  playGame,
  type BoardState,
  type GameStatus,
  type Move,
  type Seat,
  type Square,
  type Turn,
  type TurnEvents,
} from "@rotochess/engine";

/**
 * Versioned storage key for the turn history (never the full BoardState —
 * the game IS initialState + turns, so rehydration is a replay). Bump the
 * suffix on any format change; unreadable data is discarded silently.
 */
const STORAGE_KEY = "roto.hotseat.game.v1";

function clearSavedGame(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // private mode etc. — nothing to clear
  }
}

export interface HotseatGame {
  /** The authoritative state (before any staged submove). */
  state: BoardState;
  /** What the board should DISPLAY (staged submove applied, if any). */
  displayState: BoardState;
  status: GameStatus;
  draws: { threefold: boolean; fiftyMove: boolean };
  turns: readonly Turn[];
  opening: boolean;
  stagedFirst: Move | null;
  selected: Square | null;
  /** Legal moves from the selected square in the current (staged?) context. */
  selectionMoves: readonly Move[];
  /** Candidate moves to the chosen destination (>1 = needs rotDir choice). */
  pending: readonly Move[];
  /** The candidate currently highlighted in the confirm bar. */
  pendingChoice: Move | null;
  lastMoveSquares: readonly Square[];
  /** Events from the most recently applied turn (halos, evaporations…). */
  lastEvents: TurnEvents | null;
  /** Who played the turn `lastEvents` describes (the seat has since passed). */
  lastEventsSeat: Seat | null;
  tap: (square: Square) => void;
  choosePending: (move: Move) => void;
  confirm: () => void;
  /** Cancels only the pending destination; selection survives. */
  cancelPending: () => void;
  cancel: () => void;
  unstage: () => void;
  reset: () => void;
}

export function useHotseatGame(): HotseatGame {
  const [state, setState] = useState<BoardState>(() => initialState());
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  const [stagedFirst, setStagedFirst] = useState<Move | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [pending, setPending] = useState<readonly Move[]>([]);
  const [pendingChoice, setPendingChoice] = useState<Move | null>(null);
  const [lastMoveSquares, setLastMoveSquares] = useState<readonly Square[]>([]);
  const [lastEvents, setLastEvents] = useState<TurnEvents | null>(null);
  const [lastEventsSeat, setLastEventsSeat] = useState<Seat | null>(null);

  // ---- persistence: a refresh must not destroy a live four-player game ----

  // Rehydrate once on mount by replaying the stored turns through the
  // engine (playGame validates every turn; anything corrupt throws and the
  // saved game is discarded silently).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored: unknown = JSON.parse(raw);
      if (!Array.isArray(stored) || stored.length === 0) return;
      const savedTurns = stored as Turn[];
      const fold = playGame(savedTurns);
      setState(fold.finalState);
      setTurns(savedTurns);
      const last = savedTurns[savedTurns.length - 1];
      if (last) {
        const touched: Square[] = [];
        for (const sub of last.submoves) touched.push(sub.from, sub.to);
        setLastMoveSquares(touched);
      }
    } catch {
      clearSavedGame();
    }
  }, []);

  // Persist the turn history on every change (skipping the initial render,
  // which would otherwise clobber a saved game before rehydration lands).
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    try {
      if (turns.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(turns));
      }
    } catch {
      // storage unavailable — play continues, just unsaved
    }
  }, [turns]);

  const opening = inOpening(state);

  const displayState = useMemo(
    () => (stagedFirst ? applySubmove(state, stagedFirst) : state),
    [state, stagedFirst],
  );

  const status = useMemo(() => evaluateStatus(state), [state]);
  const draws = useMemo(() => claimableDraws(state), [state]);

  /** The legal set for the current phase: firsts, or seconds after staging. */
  const availableMoves = useMemo(() => {
    if (status.kind !== "active") return [];
    if (stagedFirst) return legalSecondSubmoves(state, stagedFirst);
    return legalMoves(state);
  }, [state, stagedFirst, status.kind]);

  const selectionMoves = useMemo(
    () =>
      selected === null
        ? []
        : availableMoves.filter((m) => m.from === selected),
    [availableMoves, selected],
  );

  const tap = useCallback(
    (square: Square) => {
      if (status.kind !== "active") return;
      // Choosing a destination?
      if (selected !== null) {
        const candidates = selectionMoves.filter((m) => m.to === square);
        if (candidates.length > 0) {
          setPending(candidates);
          setPendingChoice(candidates[0] ?? null);
          return;
        }
      }
      // Tapping the already-selected piece deselects (UX §1.2).
      if (square === selected) {
        setSelected(null);
        setPending([]);
        setPendingChoice(null);
        return;
      }
      // (Re)select one of the mover's pieces with legal moves.
      const hasMoves = availableMoves.some((m) => m.from === square);
      if (hasMoves) {
        setSelected(square);
        setPending([]);
        setPendingChoice(null);
        return;
      }
      // Tap elsewhere: deselect.
      setSelected(null);
      setPending([]);
      setPendingChoice(null);
    },
    [availableMoves, selected, selectionMoves, status.kind],
  );

  /** Cancel the pending destination but KEEP the selection (UX §2.3). */
  const cancelPending = useCallback(() => {
    setPending([]);
    setPendingChoice(null);
  }, []);

  /** Full clear (post-confirm, unstage, game reset). */
  const cancel = useCallback(() => {
    setPending([]);
    setPendingChoice(null);
    setSelected(null);
  }, []);

  const unstage = useCallback(() => {
    setStagedFirst(null);
    cancel();
  }, [cancel]);

  const confirm = useCallback(() => {
    if (!pendingChoice) return;
    if (opening && !stagedFirst) {
      // Stage submove 1 locally; the turn is not submitted yet.
      setStagedFirst(pendingChoice);
      cancel();
      return;
    }
    const turn: Turn = stagedFirst
      ? { submoves: [stagedFirst, pendingChoice] as const }
      : { submoves: [pendingChoice] as const };
    const mover = state.activeSeat;
    const result = applyTurn(state, turn);
    if (!result.ok) {
      // Should be unreachable (moves come from the engine's own legal sets);
      // recover by resetting the interaction.
      setStagedFirst(null);
      cancel();
      return;
    }
    const touched: Square[] = [];
    for (const sub of turn.submoves) touched.push(sub.from, sub.to);
    setState(result.state);
    setTurns((prev) => [...prev, turn]);
    setLastMoveSquares(touched);
    setLastEvents(result.events);
    setLastEventsSeat(mover);
    setStagedFirst(null);
    cancel();
  }, [cancel, opening, pendingChoice, stagedFirst, state]);

  const choosePending = useCallback((move: Move) => {
    setPendingChoice(move);
  }, []);

  const reset = useCallback(() => {
    clearSavedGame();
    setState(initialState());
    setTurns([]);
    setStagedFirst(null);
    setLastMoveSquares([]);
    setLastEvents(null);
    setLastEventsSeat(null);
    cancel();
  }, [cancel]);

  return {
    state,
    displayState,
    status,
    draws,
    turns,
    opening,
    stagedFirst,
    selected,
    selectionMoves,
    pending,
    pendingChoice,
    lastMoveSquares,
    lastEvents,
    lastEventsSeat,
    tap,
    choosePending,
    confirm,
    cancelPending,
    cancel,
    unstage,
    reset,
  };
}

export { legalMovesFrom };
