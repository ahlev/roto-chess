"use client";

/**
 * DemoBoard — a small interactive annulus for the rules page, powered by the
 * REAL engine, walking the REAL confirm flow. Tap a piece of the demo's
 * active seat and its true legal moves light up; tap a target and the actual
 * in-game ConfirmBar opens inline (embedded), showing that move's own
 * consequence — the amber evaporate warning, "earns a Halo", or "Avenger —
 * penalty-free". Confirm plays the consequence out on the board (the unhaloed
 * crosser vanishes; the haloed one lights its ring); Reset restores the
 * scenario. Read-only to the outside: the `state` prop is never mutated.
 */
import { useState } from "react";
import {
  applySubmove,
  legalMovesFrom,
  type BoardState,
  type Move,
  type Square,
} from "@rotochess/engine";
import { RotoBoard } from "./RotoBoard";
import { ConfirmBar } from "@/components/game/ConfirmBar";
import { bestPreview } from "@/lib/game/demo-preview";

interface Resolved {
  evaporate: Square[];
  bloom: Square[];
}

export function DemoBoard({
  state,
  caption,
  className,
}: {
  state: BoardState;
  caption?: string;
  className?: string;
}) {
  // Working board: starts at the given scenario, advances once on Confirm.
  const [working, setWorking] = useState<BoardState>(state);
  const [selected, setSelected] = useState<Square | null>(null);
  // The move(s) under confirmation — `pending` drives the ConfirmBar's option
  // pills (promotion, two-way routes); `choice` is the highlighted one.
  const [pending, setPending] = useState<readonly Move[]>([]);
  const [choice, setChoice] = useState<Move | null>(null);
  // Set once a move has been played out; its squares drive the animation and
  // the presence of the Reset control.
  const [resolved, setResolved] = useState<Resolved | null>(null);

  const confirming = choice !== null;
  const moves =
    selected !== null && !confirming && !resolved
      ? legalMovesFrom(working, selected)
      : [];

  const reset = () => {
    setWorking(state);
    setSelected(null);
    setPending([]);
    setChoice(null);
    setResolved(null);
  };

  const handleTap = (sq: Square) => {
    if (resolved || confirming) return; // Reset / Cancel-Confirm own these states
    // Tapping a highlighted destination opens the confirm bar for it.
    if (selected !== null && sq !== selected) {
      const candidates = moves.filter((m) => m.to === sq);
      if (candidates.length > 0) {
        setPending(candidates);
        setChoice(bestPreview(candidates) ?? candidates[0] ?? null);
        return;
      }
    }
    // Otherwise (de)select a piece of the active seat.
    setSelected((prev) =>
      prev === sq
        ? null
        : working.board[sq] && working.board[sq]?.seat === working.activeSeat
          ? sq
          : null,
    );
  };

  const confirm = () => {
    if (!choice) return;
    setWorking(applySubmove(working, choice));
    setResolved({
      evaporate: choice.evaporates ? [choice.to] : [],
      // A move can both capture and earn a halo; only skip the bloom when the
      // piece is doomed to evaporate anyway.
      bloom: choice.earnsHalo && !choice.evaporates ? [choice.to] : [],
    });
    setPending([]);
    setChoice(null);
    setSelected(null);
  };

  const cancel = () => {
    setPending([]);
    setChoice(null);
  };

  return (
    <figure className={className}>
      <RotoBoard
        state={working}
        orientation={1}
        selected={confirming ? null : selected}
        legalTargets={confirming ? [] : moves}
        pendingMove={choice}
        evaporateSquares={resolved?.evaporate ?? []}
        bloomSquares={resolved?.bloom ?? []}
        interactive={!resolved}
        onSquareTap={handleTap}
        className="w-full"
        // Demos sit in prose grids/columns — never outgrow them.
        grow={false}
      />

      {choice && (
        <ConfirmBar
          embedded
          state={working}
          pending={pending}
          choice={choice}
          openingStep={null}
          onChoose={setChoice}
          onConfirm={confirm}
          onCancel={cancel}
        />
      )}

      {resolved && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-[color:var(--ink-dim)]/40 px-4 py-1 text-xs text-[color:var(--ink-dim)] hover:text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-instrument-sans)" }}
          >
            ↺ Reset the board
          </button>
        </div>
      )}

      {caption && (
        <figcaption
          className="pt-2 text-center text-xs text-[color:var(--ink-dim)]"
          style={{ fontFamily: "var(--font-instrument-sans)" }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
