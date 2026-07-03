"use client";

/**
 * The living hero board: plays a plausible slow game against itself,
 * one move every few seconds, and quietly resets. Non-interactive; pauses
 * under reduced motion (a static initial position is just as handsome).
 */
import { useEffect, useRef, useState } from "react";
import {
  applyTurn,
  evaluateStatus,
  initialState,
  legalMoves,
  legalSecondSubmoves,
  type BoardState,
  type Move,
  type Turn,
} from "@rotochess/engine";
import { RotoBoard } from "./RotoBoard";

export function HeroBoard({ className }: { className?: string }) {
  const [state, setState] = useState<BoardState>(() => initialState());
  const [lastMove, setLastMove] = useState<readonly number[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return; // hold the pose
    }
    const timer = window.setInterval(() => {
      const current = stateRef.current;
      if (evaluateStatus(current).kind !== "active" || current.ply > 70) {
        setState(initialState());
        setLastMove([]);
        return;
      }
      const firsts = legalMoves(current);
      if (firsts.length === 0) {
        setState(initialState());
        return;
      }
      // Mildly capture-hungry random play reads as a real game.
      const pick = (moves: Move[]): Move => {
        const captures = moves.filter((m) => m.captures !== undefined);
        const pool =
          captures.length > 0 && Math.random() < 0.5 ? captures : moves;
        return pool[Math.floor(Math.random() * pool.length)] as Move;
      };
      const first = pick(firsts);
      let turn: Turn;
      if (current.ply < 20) {
        const seconds = legalSecondSubmoves(current, first);
        if (seconds.length === 0) {
          setState(initialState());
          return;
        }
        turn = { submoves: [first, pick(seconds)] as const };
      } else {
        turn = { submoves: [first] as const };
      }
      const applied = applyTurn(current, turn);
      if (!applied.ok) {
        setState(initialState());
        return;
      }
      setState(applied.state);
      setLastMove(turn.submoves.flatMap((m) => [m.from, m.to]));
    }, 2800);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <RotoBoard
      state={state}
      orientation={1}
      interactive={false}
      lastMove={lastMove}
      className={className ?? ""}
      // The hero shares its column with marketing copy — never outgrow it.
      grow={false}
    />
  );
}
