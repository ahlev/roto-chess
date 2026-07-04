"use client";

/**
 * Game room — one route, three states: lobby (seat plaques + invite),
 * live (board + confirm bar + history), game-over (result sheet over a
 * still-readable board).
 */
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  gameToRotoPgn,
  parseGame,
  partnerOf,
  type Seat,
  type Turn,
} from "@rotochess/engine";
import { RotoBoard } from "@/components/board/RotoBoard";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { CapturesTray } from "@/components/game/CapturesTray";
import { ConfirmBar } from "@/components/game/ConfirmBar";
import { NotationList } from "@/components/game/NotationList";
import { ChatPanel, type ChatOpenRequest } from "@/components/game/ChatPanel";
import { EndGameActions } from "@/components/game/EndGameActions";
import { SeatPlaques } from "@/components/game/SeatPlaques";
import { emitAttention } from "@/components/game/attention";
import { useOnlineGame } from "@/components/game/useOnlineGame";
import { browserClient } from "@/lib/supabase/client";
import { BRAND } from "@/config/brand";

const SEAT_NAME: Record<Seat, string> = {
  1: "North",
  2: "East",
  3: "South",
  4: "West",
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
  const [chatRequest, setChatRequest] = useState<ChatOpenRequest | null>(null);
  const replay = useReplayedTurns(game.gameId, game.turnsCount, game.lastMoveAt);

  const orientation: Seat = game.mySeat ?? 1;
  const openingStep =
    game.state && game.state.ply < 20 ? (game.stagedFirst ? 2 : 1) : null;

  const isMyTurn =
    game.gameStatus === "active" &&
    game.mySeat !== null &&
    game.state !== null &&
    game.state.activeSeat === game.mySeat;

  // Attention event on the your-turn edge (the visual pill is below; a
  // board glow ships separately). sound: your-turn
  const wasMyTurnRef = useRef(false);
  useEffect(() => {
    if (isMyTurn && !wasMyTurnRef.current) emitAttention("your-turn");
    wasMyTurnRef.current = isMyTurn;
  }, [isMyTurn]);

  // Clicking your PARTNER's plaque opens the Partners line; anyone else's
  // opens the whole-table channel.
  const openChatFor = useCallback(
    (seat: Seat) => {
      const channel =
        game.mySeat !== null && seat === partnerOf(game.mySeat)
          ? ("partners" as const)
          : ("table" as const);
      setChatRequest((prev) => ({ channel, nonce: (prev?.nonce ?? 0) + 1 }));
    },
    [game.mySeat],
  );

  const statusLine = useMemo(() => {
    if (!game.state) return "";
    if (game.gameStatus === "complete") {
      if (game.result === "team_13") return "Red & Blue take the crown.";
      if (game.result === "team_24") return "Black & Gold take the crown.";
      return "A draw — the crown stays on the table.";
    }
    if (game.gameStatus === "dormant") {
      return "This table went quiet. The game sleeps; it can always resume.";
    }
    if (game.gameStatus === "abandoned") {
      return "Closed as abandoned.";
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
    try {
      const url = `${window.location.origin}/join/${game.joinCode}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be denied; the code is displayed right above anyway.
      setCopied(false);
    }
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
        <div className="mt-4">
          {/* RLS admits only participants to this page, so everyone here is
              already seated — empty plaques are invitations for the LINK,
              not buttons. Joining happens through /join/[code]. */}
          <SeatPlaques
            seats={game.seats}
            mySeat={game.mySeat}
            activeSeat={null}
            vacantHint="open — send the link"
          />
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
      <SeatPlaques
        seats={game.seats}
        mySeat={game.mySeat}
        activeSeat={game.gameStatus === "active" ? game.state.activeSeat : null}
        onSeatClick={openChatFor}
      />

      <div className="relative py-2">
        <p
          aria-live="polite"
          data-testid="status-line"
          className="px-16 text-center text-sm text-text-dim"
        >
          {isMyTurn ? (
            <>
              {/* Strong your-turn treatment; a board-level glow ships
                  separately. */}
              <span className="inline-block rounded-full bg-[color:var(--focus-ring)] px-3 py-0.5 text-sm font-bold text-[color:var(--ink)]">
                Your move
              </span>
              <span className="ml-2">
                The table is watching.
                {openingStep ? ` Move ${openingStep} of 2.` : ""}
              </span>
            </>
          ) : (
            statusLine
          )}
        </p>
        <button
          type="button"
          className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full border border-line px-2 py-1 text-xs text-text-dim"
          onClick={() => setShowHistory((v) => !v)}
        >
          {showHistory ? "Board" : "History"}
        </button>
      </div>

      {game.submitError && (
        <p
          aria-live="assertive"
          className="pb-2 text-center text-xs text-[color:var(--danger)]"
        >
          {game.submitError}
        </p>
      )}

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
        <>
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
          {/* Online: the ledger follows the CANONICAL record (replay.turns,
              refetched as turns persist). We deliberately do NOT feed the
              local optimistic stagedFirst here — it's computed against
              game.state, not this DB-replayed fold, so composing them can
              blank or mis-credit a capture. Immediacy lives in hotseat, where
              turns and stagedFirst share one coherent hook. */}
          <CapturesTray turns={replay.turns ?? []} />
        </>
      )}

      {showHistory && <HistoryPane turns={replay.turns} failed={replay.failed} />}

      {game.gameStatus === "active" &&
        game.mySeat !== null &&
        game.myUserId &&
        game.state && (
          <EndGameActions
            gameId={game.gameId}
            mySeat={game.mySeat}
            myUserId={game.myUserId}
            currentPly={game.turnsCount}
            activeSeat={game.state.activeSeat}
            seats={game.seats.map((s) => ({
              seat: s.seat,
              userId: s.userId,
              displayName: s.displayName,
            }))}
            actions={game.actions}
            draws={game.draws}
            lastMoveAt={game.lastMoveAt}
            onChanged={() => void game.refetch()}
          />
        )}

      {game.gameStatus === "complete" && (
        <ResultSheet
          statusLine={statusLine}
          reason={game.resultReason}
          tableId={game.tableId}
          gameId={game.gameId}
          mySeat={game.mySeat}
        />
      )}

      {game.tableId && game.myUserId && (
        <div className="mt-4">
          <ChatPanel
            tableId={game.tableId}
            gameId={game.gameId}
            myUserId={game.myUserId}
            seats={game.seats}
            mySeat={game.mySeat}
            openRequest={chatRequest}
          />
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
  return <SiteHeader home="/app" links={[{ href: "/app", label: "My games" }]} />;
}

/**
 * Result sheet: the verdict, the running SERIES TALLY across the table's
 * episodes, "Run it back" (same seats or rotated), and .rpgn export.
 */
function ResultSheet({
  statusLine,
  reason,
  tableId,
  gameId,
  mySeat,
}: {
  statusLine: string;
  reason: string | null;
  tableId: string | null;
  gameId: string;
  mySeat: Seat | null;
}) {
  const router = useRouter();
  const [tally, setTally] = useState<{
    ns: number;
    ew: number;
    draws: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const loadTally = useCallback(async () => {
    const supabase = browserClient();
    if (!supabase || !tableId) return;
    const { data } = await supabase
      .from("games")
      .select("result")
      .eq("table_id", tableId)
      .not("result", "is", null);
    let ns = 0;
    let ew = 0;
    let draws = 0;
    for (const row of data ?? []) {
      if (row.result === "team_13") ns++;
      else if (row.result === "team_24") ew++;
      else draws++;
    }
    setTally({ ns, ew, draws });
  }, [tableId]);

  useEffect(() => {
    void loadTally();
  }, [loadTally]);

  const runItBack = async (rotate: boolean) => {
    if (!tableId) return;
    setBusy(true);
    setNote(null);
    const seat: Seat | undefined =
      mySeat === null
        ? undefined
        : rotate
          ? ((((mySeat - 1 + 1) % 4) + 1) as Seat)
          : mySeat;
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tableId, seat }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setNote(body?.error ?? "The rematch didn't take. Try again.");
      setBusy(false);
      return;
    }
    const body = (await res.json()) as {
      gameId: string;
      joinCode?: string;
      existing?: boolean;
    };
    if (body.existing && body.joinCode) {
      // Someone else already set the rematch board — take a seat in it.
      router.push(`/join/${body.joinCode}`);
      return;
    }
    router.push(`/app/game/${body.gameId}`);
  };

  const exportRpgn = async () => {
    const supabase = browserClient();
    if (!supabase) return;
    const { data } = await supabase
      .from("moves")
      .select("ply, notation")
      .eq("game_id", gameId)
      .order("ply");
    if (!data) return;
    try {
      const parsed = parseGame(`${data.map((d) => d.notation).join(" ")}\n`);
      const text = gameToRotoPgn(parsed.turns, { site: BRAND.name });
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "roto-game.rpgn";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setNote("The record wouldn't replay for export.");
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-line bg-surface-raised p-4 text-center">
      <p
        className="text-2xl text-text"
        style={{ fontFamily: "var(--font-instrument-serif)" }}
        data-testid="result-line"
      >
        {statusLine}
      </p>
      <p className="mt-1 text-xs text-text-dim">{reason ?? ""}</p>
      {tally && (
        <p
          className="mt-2 text-sm text-text"
          style={{ fontFamily: "var(--font-plex-mono)" }}
          data-testid="series-tally"
        >
          Red&Blue {tally.ns} — {tally.ew} Black&Gold
          {tally.draws > 0 ? ` · ${tally.draws} drawn` : ""}
        </p>
      )}
      {note && (
        <p className="mt-2 text-xs text-[color:var(--danger)]">{note}</p>
      )}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {mySeat !== null && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => runItBack(false)}
              className="rounded-full bg-[color:var(--focus-ring)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]"
            >
              Again. Same seats?
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => runItBack(true)}
              className="rounded-full border border-line px-4 py-2 text-sm text-text-dim"
            >
              Rotate seats
            </button>
          </>
        )}
        <button
          type="button"
          onClick={exportRpgn}
          className="rounded-full border border-line px-4 py-2 text-sm text-text-dim"
        >
          Export .rpgn
        </button>
        <Link
          href="/app"
          className="rounded-full border border-line px-4 py-2 text-sm text-text-dim"
        >
          Back to your games
        </Link>
      </div>
    </div>
  );
}

/**
 * The canonical turn list, fetched from the moves table and replay-
 * validated by parseGame. Feeds both the history pane and the captures
 * tray. Refetches when the ply count moves (remote turns) and when
 * last_move_at lands from the server (our own just-committed turn — the
 * optimistic ply bump fires before the move row exists).
 */
function useReplayedTurns(
  gameId: string,
  turnsCount: number,
  lastMoveAt: string | null,
): { turns: readonly Turn[] | null; failed: boolean } {
  const [turns, setTurns] = useState<readonly Turn[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = browserClient();
    if (!supabase) return;
    let cancelled = false;
    void supabase
      .from("moves")
      .select("ply, notation")
      .eq("game_id", gameId)
      .order("ply")
      .then(({ data }) => {
        if (cancelled) return;
        if (!data) {
          setFailed(true);
          return;
        }
        try {
          // Rebuild a movetext document and let the replay-based parser
          // validate everything.
          const text = `${data.map((d) => d.notation).join(" ")}\n`;
          setTurns(parseGame(text).turns);
          setFailed(false);
        } catch {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, turnsCount, lastMoveAt]);

  return { turns, failed };
}

/** History from the canonical record (replayed notation, not local state). */
function HistoryPane({
  turns,
  failed,
}: {
  turns: readonly Turn[] | null;
  failed: boolean;
}) {
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
