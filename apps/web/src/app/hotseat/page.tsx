"use client";

/**
 * Hotseat — a complete four-player local game on one screen, no backend.
 * The M4 gate: "is this Roto Chess?" Per-seat rotation follows the active
 * player (pass-and-play), rotation switches instantly (never animated
 * mid-game), and the opening's two-move staging is enforced in the UI.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { gameToRotoPgn, type Seat } from "@rotochess/engine";
import { RotoBoard } from "@/components/board/RotoBoard";
import { ConfirmBar } from "@/components/game/ConfirmBar";
import { NotationList } from "@/components/game/NotationList";
import { useHotseatGame } from "@/components/game/useHotseatGame";
import { BRAND } from "@/config/brand";

const SEAT_NAME: Record<Seat, string> = {
  1: "North",
  2: "East",
  3: "South",
  4: "West",
};

export default function HotseatPage() {
  const game = useHotseatGame();
  const [rotateToActive, setRotateToActive] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const orientation: Seat = rotateToActive ? game.state.activeSeat : 1;
  const openingStep = game.opening ? (game.stagedFirst ? 2 : 1) : null;

  const statusLine = useMemo(() => {
    const s = game.status;
    if (s.kind === "checkmate") {
      const winners = s.winningTeam === 1 ? "Red & Blue" : "Black & Gold";
      return `${winners} take the crown.`;
    }
    if (s.kind === "stalemate") return "Stalemate — a draw for all four.";
    const seat = game.state.activeSeat;
    const checks = s.inCheck.length
      ? ` · Check on ${s.inCheck.map((c) => SEAT_NAME[c]).join(" and ")}`
      : "";
    const step = openingStep ? ` — move ${openingStep} of 2` : "";
    return `${SEAT_NAME[seat]} to move${step}${checks}`;
  }, [game.state.activeSeat, game.status, openingStep]);

  const exportRpgn = () => {
    const text = gameToRotoPgn(game.turns, {
      event: "Hotseat game",
      site: BRAND.name,
    });
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "roto-game.rpgn";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-3 pb-28">
      <header className="flex items-center justify-between py-3">
        <Link
          href="/"
          className="text-xl text-text"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          {BRAND.name}
        </Link>
        <div className="flex items-center gap-3 text-xs text-text-dim">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={rotateToActive}
              onChange={(e) => setRotateToActive(e.target.checked)}
            />
            rotate to player
          </label>
          <button
            type="button"
            className="rounded border border-line px-2 py-1"
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? "Board" : "History"}
          </button>
          <button
            type="button"
            className="rounded border border-line px-2 py-1"
            onClick={exportRpgn}
          >
            .rpgn
          </button>
        </div>
      </header>

      <p
        data-testid="status-line"
        className="pb-2 text-center text-sm text-text-dim"
      >
        {statusLine}
      </p>

      {game.stagedFirst && (
        <div className="mb-2 flex items-center justify-center gap-2 text-xs text-text-dim">
          <span>first move staged</span>
          <button
            type="button"
            onClick={game.unstage}
            className="rounded border border-line px-2 py-0.5"
            data-testid="unstage"
          >
            undo
          </button>
        </div>
      )}

      {!showHistory && (
        <RotoBoard
          state={game.displayState}
          orientation={orientation}
          selected={game.selected}
          legalTargets={game.selectionMoves}
          pendingMove={game.pendingChoice}
          lastMove={game.lastMoveSquares}
          interactive={game.status.kind === "active"}
          onSquareTap={game.tap}
          className="w-full"
        />
      )}

      {showHistory && (
        <div className="min-h-64 rounded-lg border border-line bg-surface">
          <NotationList turns={game.turns} />
        </div>
      )}

      {game.status.kind !== "active" && (
        <div className="mt-4 rounded-lg border border-line bg-surface-raised p-4 text-center">
          <p
            className="text-2xl text-text"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
            data-testid="result-line"
          >
            {statusLine}
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <button
              type="button"
              onClick={game.reset}
              className="rounded-lg bg-[color:var(--focus-ring)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]"
            >
              Again. Same seats?
            </button>
            <button
              type="button"
              onClick={exportRpgn}
              className="rounded-lg border border-line px-4 py-2 text-sm text-text-dim"
            >
              Export .rpgn
            </button>
          </div>
        </div>
      )}

      {(game.draws.threefold || game.draws.fiftyMove) &&
        game.status.kind === "active" && (
          <p className="mt-2 text-center text-xs text-[color:var(--halo)]">
            A draw may be claimed (
            {game.draws.threefold ? "threefold repetition" : "fifty-move rule"}
            ).
          </p>
        )}

      <ConfirmBar
        state={game.stagedFirst ? game.displayState : game.state}
        pending={game.pending}
        choice={game.pendingChoice}
        openingStep={openingStep}
        onChoose={game.choosePending}
        onConfirm={game.confirm}
        onCancel={game.cancel}
      />
    </main>
  );
}
