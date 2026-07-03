"use client";

/**
 * Game room — one route, three states: lobby (seat plaques + invite),
 * live (board + confirm bar + history), game-over (result sheet over a
 * still-readable board).
 */
import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  SEAT_COMPASS,
  parseGame,
  type Seat,
} from "@rotochess/engine";
import { RotoBoard } from "@/components/board/RotoBoard";
import { ConfirmBar } from "@/components/game/ConfirmBar";
import { NotationList } from "@/components/game/NotationList";
import { useOnlineGame } from "@/components/game/useOnlineGame";
import { browserClient } from "@/lib/supabase/client";
import { BRAND } from "@/config/brand";

const SEAT_NAME: Record<Seat, string> = {
  1: "North",
  2: "East",
  3: "South",
  4: "West",
};

const SEAT_TEXT: Record<Seat, string> = {
  1: "text-[color:var(--north-red-bright)]",
  2: "text-[color:var(--east-black-bright)]",
  3: "text-[color:var(--south-blue-bright)]",
  4: "text-[color:var(--west-gold-bright)]",
};

export default function GameRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const game = useOnlineGame(id);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  const orientation: Seat = game.mySeat ?? 1;
  const openingStep =
    game.state && game.state.ply < 20 ? (game.stagedFirst ? 2 : 1) : null;

  const statusLine = useMemo(() => {
    if (!game.state) return "";
    if (game.gameStatus === "complete") {
      if (game.result === "team_13") return "Red & Blue take the crown.";
      if (game.result === "team_24") return "Black & Gold take the crown.";
      return "A draw — the crown stays on the table.";
    }
    const seat = game.state.activeSeat;
    const mine = game.mySeat === seat;
    const step =
      openingStep && mine ? ` — move ${openingStep} of 2` : "";
    return mine
      ? `Your move. The table is watching.${step}`
      : `${SEAT_NAME[seat]} is thinking…`;
  }, [game.state, game.gameStatus, game.result, game.mySeat, openingStep]);

  if (game.loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-text-dim">
        Setting the table…
      </main>
    );
  }
  if (game.error || !game.state) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-text">{game.error ?? "Something wobbled."}</p>
        <Link href="/app" className="text-sm text-text-dim underline">
          Back to your games
        </Link>
      </main>
    );
  }

  const copyInvite = async () => {
    const url = `${window.location.origin}/join/${game.joinCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ---- LOBBY ----
  if (game.gameStatus === "lobby") {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col px-3">
        <Header />
        <p className="pb-3 text-center text-sm text-text-dim">
          The board is set. The seats are not.
        </p>
        <RotoBoard
          state={game.state}
          orientation={orientation}
          interactive={false}
          className="w-full opacity-90"
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          {([1, 2, 3, 4] as const).map((seat) => {
            const taken = game.seats.find((s) => s.seat === seat);
            const isJoinable = !taken && game.mySeat === null;
            return (
              <div
                key={seat}
                className={`rounded-lg border border-line p-3 text-sm ${SEAT_TEXT[seat]}`}
              >
                <span className="font-semibold">
                  {SEAT_COMPASS[seat]} · {SEAT_NAME[seat]}
                </span>
                <div className="mt-1 text-text-dim">
                  {taken ? (
                    taken.displayName
                  ) : isJoinable ? (
                    <TakeSeat code={game.joinCode ?? ""} seat={seat} onJoined={game.refetch} />
                  ) : (
                    "open"
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 rounded-lg border border-line bg-surface p-3 text-center">
          <p className="text-xs text-text-dim">Fill the seats</p>
          <p
            className="mt-1 text-2xl tracking-widest text-text"
            style={{ fontFamily: "var(--font-plex-mono)" }}
          >
            ROTO-{game.joinCode}
          </p>
          <button
            type="button"
            onClick={copyInvite}
            className="mt-2 rounded-full border border-line px-4 py-1 text-sm text-text-dim"
          >
            {copied ? "Copied." : "Copy invite link"}
          </button>
          <p className="mt-2 text-xs text-text-dim">
            {game.seats.length}/4 seated — the game opens when the table is
            full.
          </p>
        </div>
      </main>
    );
  }

  // ---- LIVE + GAME OVER ----
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-3 pb-28">
      <Header />
      <div className="flex items-center justify-between pb-1 text-xs text-text-dim">
        <div className="flex gap-2">
          {game.seats.map((s) => (
            <span
              key={s.seat}
              className={`${SEAT_TEXT[s.seat]} ${
                game.state?.activeSeat === s.seat ? "font-bold" : ""
              }`}
            >
              {SEAT_COMPASS[s.seat]}·{s.displayName}
              {s.seat === game.mySeat ? " (you)" : ""}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="rounded-full border border-line px-2 py-1"
          onClick={() => setShowHistory((v) => !v)}
        >
          {showHistory ? "Board" : "History"}
        </button>
      </div>

      <p
        aria-live="polite"
        data-testid="status-line"
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
            className="rounded-full border border-line px-2 py-0.5"
          >
            Take it back
          </button>
        </div>
      )}

      {!showHistory && game.displayState && (
        <RotoBoard
          state={game.displayState}
          orientation={orientation}
          selected={game.selected}
          legalTargets={game.selectionMoves}
          pendingMove={game.pendingChoice}
          lastMove={game.lastMoveSquares}
          interactive={
            game.gameStatus === "active" &&
            game.mySeat !== null &&
            game.state.activeSeat === game.mySeat
          }
          onSquareTap={game.tap}
          className="w-full"
        />
      )}

      {showHistory && <HistoryPane gameId={game.gameId} />}

      {game.gameStatus === "complete" && (
        <div className="mt-4 rounded-lg border border-line bg-surface-raised p-4 text-center">
          <p
            className="text-2xl text-text"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
            data-testid="result-line"
          >
            {statusLine}
          </p>
          <p className="mt-1 text-xs text-text-dim">
            {game.resultReason ?? ""}
          </p>
          <Link
            href="/app"
            className="mt-3 inline-block rounded-full border border-line px-4 py-2 text-sm text-text-dim"
          >
            Back to your games
          </Link>
        </div>
      )}

      {game.state && (
        <ConfirmBar
          state={
            game.stagedFirst && game.displayState
              ? game.displayState
              : game.state
          }
          pending={game.pending}
          choice={game.pendingChoice}
          openingStep={openingStep}
          onChoose={game.choosePending}
          onConfirm={game.confirm}
          onCancel={game.cancelPending}
        />
      )}
    </main>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between py-3">
      <Link
        href="/app"
        className="text-xl text-text"
        style={{ fontFamily: "var(--font-instrument-serif)" }}
      >
        {BRAND.name}
      </Link>
      <Link href="/app" className="text-xs text-text-dim underline">
        My games
      </Link>
    </header>
  );
}

/** Claim a seat via the join_game RPC (RLS-safe, race-safe). */
function TakeSeat({
  code,
  seat,
  onJoined,
}: {
  code: string;
  seat: Seat;
  onJoined: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const take = async () => {
    const supabase = browserClient();
    if (!supabase) return;
    setBusy(true);
    await supabase.rpc("join_game", { p_code: code, p_seat: seat });
    await onJoined();
    setBusy(false);
  };
  return (
    <button
      type="button"
      onClick={take}
      disabled={busy}
      className="rounded-full border border-line px-3 py-0.5 text-xs text-text"
    >
      {busy ? "…" : "Take a seat"}
    </button>
  );
}

/** History fetched from the moves table (canonical notation, replayed). */
function HistoryPane({ gameId }: { gameId: string }) {
  const [turns, setTurns] = useState<ReturnType<typeof parseGame>["turns"] | null>(null);
  const [failed, setFailed] = useState(false);

  useMemo(() => {
    const supabase = browserClient();
    if (!supabase) return;
    void supabase
      .from("moves")
      .select("ply, notation")
      .eq("game_id", gameId)
      .order("ply")
      .then(({ data }) => {
        if (!data) {
          setFailed(true);
          return;
        }
        try {
          // Rebuild a movetext document and let the replay-based parser
          // validate everything.
          const text = `${data.map((d) => d.notation).join(" ")}\n`;
          setTurns(parseGame(text).turns);
        } catch {
          setFailed(true);
        }
      });
  }, [gameId]);

  if (failed) {
    return (
      <p className="p-3 text-sm text-[color:var(--danger)]">
        The record wouldn't replay — refresh to try again.
      </p>
    );
  }
  return (
    <div className="min-h-64 rounded-lg border border-line bg-surface">
      {turns ? (
        <NotationList turns={turns} />
      ) : (
        <p className="p-3 text-sm text-text-dim">Reading the record…</p>
      )}
    </div>
  );
}
