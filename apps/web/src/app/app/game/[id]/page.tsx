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
  isInCheck,
  parseGame,
  partnerOf,
  SEAT_COMPASS,
  type Seat,
  type Team,
  type Turn,
} from "@rotochess/engine";
import { RotoBoard } from "@/components/board/RotoBoard";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { CapturesTray } from "@/components/game/CapturesTray";
import { ConfirmBar } from "@/components/game/ConfirmBar";
import { NotationList } from "@/components/game/NotationList";
import { ChatPanel, type ChatOpenRequest } from "@/components/game/ChatPanel";
import { EndGameActions } from "@/components/game/EndGameActions";
import { ObserverRail } from "@/components/game/ObserverRail";
import { SeatPlaques } from "@/components/game/SeatPlaques";
import { VictoryOverlay } from "@/components/game/VictoryOverlay";
import { emitAttention } from "@/components/game/attention";
import { useOnlineGame } from "@/components/game/useOnlineGame";
import { useGameSounds } from "@/lib/audio/useGameSounds";
import { recentMovesBySeat } from "@/lib/game/recentMoves";
import { victoryContext, type VictoryReason } from "@/lib/game/victory";
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

  // Move cues for every player's turn (the canonical list grows for remote
  // moves too, so you hear the table play). Check is derived cheaply from the
  // seat to move, and only while the game is live.
  const checkedNow = useMemo(
    () =>
      game.gameStatus === "active" &&
      game.state !== null &&
      isInCheck(game.state, game.state.activeSeat),
    [game.gameStatus, game.state],
  );
  useGameSounds({
    turns: replay.turns ?? [],
    checkedNow,
    staged: game.stagedFirst !== null,
    ready: replay.turns !== null,
  });

  // Between-turns cue: darken each seat's most recent from/to tiles, from the
  // canonical turn list so it reflects every player's last move at the table.
  const priorMoves = useMemo(
    () => recentMovesBySeat(replay.turns ?? []),
    [replay.turns],
  );

  // The winning team, decoded from the shared row's result (null = draw).
  const winningTeam: Team | null =
    game.result === "team_13" ? 1 : game.result === "team_24" ? 2 : null;

  // The victory card's context — built from the CANONICAL turn list (so it
  // names the mating stroke) once the game completes. Recomputed from the
  // result + reason; refines when the replayed turns arrive.
  const victory = useMemo(() => {
    if (game.gameStatus !== "complete") return null;
    const reason: VictoryReason =
      game.resultReason === "checkmate"
        ? "checkmate"
        : game.resultReason === "resignation"
          ? "resignation"
          : game.resultReason === "abandonment"
            ? "abandoned"
            : game.resultReason === "stalemate"
              ? "stalemate"
              : "draw";
    return victoryContext({
      reason,
      winningTeam,
      turns: replay.turns ?? [],
    });
  }, [game.gameStatus, game.resultReason, winningTeam, replay.turns]);

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
          {/* RLS admits participants AND observers to this page. Seated
              players see empty plaques as invitations for the LINK; an
              observer additionally gets tap-to-claim buttons below. */}
          <SeatPlaques
            seats={game.seats}
            mySeat={game.mySeat}
            activeSeat={null}
            vacantHint="open — send the link"
          />
        </div>
        <ObserverRail
          observers={game.observers}
          isObserver={game.isObserver}
          tableId={game.tableId}
          myUserId={game.myUserId}
        />
        {game.isObserver && <ClaimSeatButtons game={game} />}
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
            full.{game.isObserver ? " You're watching from the rail." : ""}
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
      <ObserverRail
        observers={game.observers}
        isObserver={game.isObserver}
        tableId={game.tableId}
        myUserId={game.myUserId}
      />

      <div className="relative py-2">
        <p
          aria-live="polite"
          data-testid="status-line"
          className="px-16 text-center text-sm text-text-dim"
        >
          {game.isObserver && (
            <span className="mr-2 inline-block rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-dim">
              Observing
            </span>
          )}
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
            priorMoves={priorMoves}
            interactive={
              game.gameStatus === "active" &&
              game.mySeat !== null &&
              game.state.activeSeat === game.mySeat
            }
            onSquareTap={game.tap}
            className="w-full"
            // The crown ceremony (winner rotation, gold rim, losers dim) —
            // wired here so the online board reacts to a finish, not freezes.
            ceremonyWinner={
              game.gameStatus === "complete" ? winningTeam : null
            }
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

      {game.gameStatus === "complete" && victory && (
        <ResultSheet
          context={victory}
          statusLine={statusLine}
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
            observers={game.observers}
            openRequest={chatRequest}
          />
        </div>
      )}

      {game.state && game.mySeat !== null && (
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
 * Result sheet: the crown moment (VictoryOverlay) fed the running SERIES
 * TALLY across the table's episodes as its `tally` slot, and "Run it back"
 * (same seats or rotated) + .rpgn export + back as its `actions`.
 */
function ResultSheet({
  context,
  statusLine,
  tableId,
  gameId,
  mySeat,
}: {
  context: ReturnType<typeof victoryContext>;
  statusLine: string;
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
    <VictoryOverlay
      context={context}
      tally={
        // A "series" only exists once the table has replayed — a lone game
        // is not a scoreboard.
        tally && tally.ns + tally.ew + tally.draws >= 2 ? (
          <SeriesTally ns={tally.ns} ew={tally.ew} draws={tally.draws} />
        ) : undefined
      }
      actions={
        <>
          {/* result-line testid preserved for the online e2e harness. */}
          <span className="sr-only" data-testid="result-line">
            {statusLine}
          </span>
          {note && (
            <p className="basis-full text-xs text-[color:var(--danger)]">
              {note}
            </p>
          )}
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
        </>
      }
    />
  );
}

/**
 * The rematch scoreboard: how the two partnerships have fared across every
 * game this table has played. Rendered as a labeled two-team score so the
 * numbers read as a series, not a single game's result. The leading side is
 * brightened; draws sit quietly beneath.
 */
function SeriesTally({
  ns,
  ew,
  draws,
}: {
  ns: number;
  ew: number;
  draws: number;
}) {
  const TeamScore = ({
    label,
    dots,
    score,
    leads,
  }: {
    label: string;
    dots: [string, string];
    score: number;
    leads: boolean;
  }) => (
    <div className="flex flex-col items-center gap-1">
      <span className="flex items-center gap-1.5 text-[11px] text-text-dim">
        <span aria-hidden className="flex gap-0.5">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: dots[0] }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: dots[1] }}
          />
        </span>
        {label}
      </span>
      <span
        className={`text-2xl leading-none ${leads ? "font-semibold text-text" : "text-text-dim"}`}
        style={{ fontFamily: "var(--font-instrument-serif)" }}
      >
        {score}
      </span>
    </div>
  );

  return (
    <div className="text-center" data-testid="series-tally">
      <p className="text-[10px] uppercase tracking-wide text-text-dim/80">
        Series at this table
      </p>
      <div className="mt-2 flex items-start justify-center gap-5">
        <TeamScore
          label="Red & Blue"
          dots={["var(--north-red-bright)", "var(--south-blue-bright)"]}
          score={ns}
          leads={ns > ew}
        />
        <span className="pt-5 text-text-dim">–</span>
        <TeamScore
          label="Black & Gold"
          dots={["var(--east-black-bright)", "var(--west-gold-bright)"]}
          score={ew}
          leads={ew > ns}
        />
      </div>
      {draws > 0 && (
        <p className="mt-1.5 text-[11px] text-text-dim">
          {draws} drawn
        </p>
      )}
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

/**
 * The observer's path to a chair: open seats are flagged; tapping one asks
 * for explicit confirmation before join_game locks it in. SEAT_TAKEN mid-
 * dialog is survivable — the doorbell refetch redraws the open seats.
 */
function ClaimSeatButtons({
  game,
}: {
  game: ReturnType<typeof useOnlineGame>;
}) {
  const [confirmSeat, setConfirmSeat] = useState<Seat | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const openSeats = ([1, 2, 3, 4] as const).filter(
    (s) => !game.seats.some((p) => p.seat === s),
  );
  if (openSeats.length === 0) return null;

  const claim = async (seat: Seat) => {
    const supabase = browserClient();
    if (!supabase || !game.joinCode || busy) return;
    setBusy(true);
    setNote(null);
    const { error } = await supabase.rpc("join_game", {
      p_code: game.joinCode,
      p_seat: seat,
    });
    setBusy(false);
    setConfirmSeat(null);
    if (error) {
      setNote(
        error.message.includes("SEAT_TAKEN")
          ? "That seat just filled. Pick another."
          : error.message.includes("GAME_NOT_JOINABLE")
            ? "The table isn't seating anymore."
            : "The table wobbled. Try again.",
      );
    }
    void game.refetch();
  };

  return (
    <div className="mt-3 rounded-lg border border-dashed border-line p-3">
      <p className="pb-2 text-center text-xs text-text-dim">
        A seat is open — you could play this one.
      </p>
      {note && (
        <p className="pb-2 text-center text-xs text-[color:var(--danger)]">
          {note}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {openSeats.map((seat) => (
          <button
            key={seat}
            type="button"
            data-testid={`claim-seat-${seat}`}
            disabled={busy}
            onClick={() => {
              setConfirmSeat(seat);
              setNote(null);
            }}
            className="min-h-11 rounded-lg border border-line p-2 text-sm text-text hover:bg-surface-raised disabled:opacity-50"
          >
            Take {SEAT_NAME[seat]} ({SEAT_COMPASS[seat]})
          </button>
        ))}
      </div>
      {confirmSeat !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Take a seat"
          onClick={() => setConfirmSeat(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-line bg-surface-raised p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="text-lg text-text"
              style={{ fontFamily: "var(--font-instrument-serif)" }}
            >
              Take the {SEAT_NAME[confirmSeat]} seat?
            </p>
            <p className="mt-1 text-sm text-text-dim">
              You'll join this game as a player — the seat locks in when you
              confirm, and you leave the rail.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSeat(null)}
                disabled={busy}
                className="rounded-full border border-line px-4 py-2 text-sm text-text-dim"
              >
                Keep watching
              </button>
              <button
                type="button"
                data-testid="claim-seat-confirm"
                onClick={() => void claim(confirmSeat)}
                disabled={busy}
                className="rounded-full bg-[color:var(--focus-ring)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]"
              >
                {busy ? "Taking the seat…" : `Take ${SEAT_NAME[confirmSeat]}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
