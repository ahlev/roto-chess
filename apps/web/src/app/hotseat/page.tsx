"use client";

/**
 * Hotseat — a complete four-player local game on one screen, no backend.
 * The M4 gate: "is this Roto Chess?" Per-seat rotation follows the active
 * player (pass-and-play), rotation switches instantly (never animated
 * mid-game), and the opening's two-move staging is enforced in the UI.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { gameToRotoPgn, partnerOf, type Seat } from "@rotochess/engine";
import { RotoBoard } from "@/components/board/RotoBoard";
import { CapturesTray } from "@/components/game/CapturesTray";
import { ConfirmBar } from "@/components/game/ConfirmBar";
import { CoachNotes } from "@/components/game/CoachNotes";
import { NotationList } from "@/components/game/NotationList";
import { useHotseatGame } from "@/components/game/useHotseatGame";
import { BRAND } from "@/config/brand";

const SEAT_NAME: Record<Seat, string> = {
  1: "North",
  2: "East",
  3: "South",
  4: "West",
};

const PIECE_NAME: Record<string, string> = {
  P: "pawn",
  N: "knight",
  B: "bishop",
  R: "rook",
  Q: "queen",
  K: "king",
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
    // §6.3 out loud: a check on a NON-active player is not yet decided —
    // the game's most counterintuitive rule, taught where it appears.
    const nonActiveChecked = s.inCheck.filter((c) => c !== seat);
    const checks = s.inCheck.length
      ? ` · Check on the ${s.inCheck
          .map((c) => `${SEAT_NAME[c]} King`)
          .join(" and the ")}${
          nonActiveChecked.length
            ? " — not checkmate unless it stands on their turn"
            : ""
        }`
      : "";
    const step = openingStep ? ` — move ${openingStep} of 2` : "";
    return `${SEAT_NAME[seat]} to move${step}${checks}`;
  }, [game.state.activeSeat, game.status, openingStep]);

  // The halo fires AFTER the turn passes, so the note must name whose piece
  // earned it — the player reading it is already the NEXT one.
  const haloNote = useMemo(() => {
    const events = game.lastEvents;
    const seat = game.lastEventsSeat;
    if (!events || seat === null || events.halosEarned.length === 0) {
      return null;
    }
    const square = events.halosEarned[0];
    const kind = square === undefined ? undefined : game.state.board[square]?.kind;
    const piece = (kind && PIECE_NAME[kind]) || "piece";
    const who = SEAT_NAME[seat];
    return `${who}'s ${piece} has earned its halo — it may now cross ${who}'s meridian freely, forever.`;
  }, [game.lastEvents, game.lastEventsSeat, game.state.board]);

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
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3">
        <div className="flex items-baseline gap-3">
          <Link
            href="/"
            className="text-xl text-text"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            {BRAND.name}
          </Link>
          {/* New tab, so a live game is never lost to a rules question. */}
          <Link
            href="/rules"
            target="_blank"
            rel="noopener"
            className="text-xs text-text-dim underline"
          >
            The Book
          </Link>
          <Link href="/learn" className="text-xs text-text-dim underline">
            Learn the game
          </Link>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-dim">
          <label className="flex min-h-11 items-center gap-1">
            <input
              type="checkbox"
              checked={rotateToActive}
              onChange={(e) => setRotateToActive(e.target.checked)}
            />
            rotate to player
          </label>
          <button
            type="button"
            className="min-h-11 rounded border border-line px-2 py-1"
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? "Board" : "History"}
          </button>
          <button
            type="button"
            className="min-h-11 rounded border border-line px-2 py-1"
            onClick={exportRpgn}
          >
            .rpgn
          </button>
        </div>
      </header>

      <p
        data-testid="status-line"
        aria-live="polite"
        className="pb-2 text-center text-sm text-text-dim"
      >
        {statusLine}
      </p>

      {game.stagedFirst && (
        <div className="mb-2 flex items-center justify-center gap-2 text-xs text-text-dim">
          <span>First move recorded.</span>
          <button
            type="button"
            onClick={game.unstage}
            className="min-h-6 rounded-full border border-line px-2 py-1"
            data-testid="unstage"
          >
            Take it back
          </button>
        </div>
      )}

      <CoachNotes
        notes={[
          {
            key: "opening",
            active: game.opening && game.status.kind === "active",
            text: "Opening rounds: each turn is TWO moves — one on each side of your meridian — then play passes. The board labels which move you're on.",
          },
          {
            key: "partner-check",
            active:
              game.status.kind === "active" &&
              game.status.inCheck.includes(
                partnerOf(game.state.activeSeat),
              ),
            text: "Your partner is in check. You're not required to help (§6.2) — but you're allowed to. Sometimes the best help is a counterattack.",
          },
          {
            key: "halo",
            active: haloNote !== null,
            text: haloNote ?? "",
          },
        ]}
      />

      {!showHistory && (
        <>
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
            ceremony={game.turns.length === 0}
            bloomSquares={game.lastEvents?.halosEarned ?? []}
            evaporateSquares={game.lastEvents?.evaporations ?? []}
            ceremonyWinner={
              game.status.kind === "checkmate" ? game.status.winningTeam : null
            }
          />
          <CapturesTray turns={game.turns} />
        </>
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
          <p className="mt-2 text-center text-xs text-text-dim">
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
        onCancel={game.cancelPending}
      />
    </main>
  );
}
