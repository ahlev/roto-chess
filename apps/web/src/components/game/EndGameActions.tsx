"use client";

/**
 * The game-end machinery, presented gently: resign (partner confirms),
 * draw offer (all four), rule claims when the engine says they exist,
 * abandonment door when the board has been silent, and the human nudge.
 *
 * Resign and draw PROPOSALS both sit behind a loud two-step gate: the
 * confirmation state is unmistakable (danger styling, explicit copy), and
 * it dissolves on its own — Escape, clicking elsewhere, or ~8 quiet
 * seconds all mean "never mind".
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { partnerOf, type Seat } from "@rotochess/engine";
import { PROPOSAL_WINDOW_PLIES } from "@/lib/game/resolve-actions";

interface ActionRowView {
  user_id: string;
  kind: string;
  ply_at: number;
}

export interface EndGameActionsProps {
  gameId: string;
  mySeat: Seat;
  myUserId: string;
  currentPly: number;
  activeSeat: Seat;
  seats: Array<{ seat: Seat; userId: string; displayName: string }>;
  actions: ActionRowView[];
  draws: { threefold: boolean; fiftyMove: boolean };
  lastMoveAt: string | null;
  onChanged: () => void;
}

/** An armed gate resets itself after this long without confirmation. */
const GATE_RESET_MS = 8_000;

type Gate = "resign" | "draw" | null;

export function EndGameActions(props: EndGameActionsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [gate, setGate] = useState<Gate>(null);
  const gateRef = useRef<HTMLDivElement | null>(null);

  // The gate stands down on its own: timeout, Escape, or a click anywhere
  // outside the confirmation block.
  useEffect(() => {
    if (gate === null) return;
    const timer = window.setTimeout(() => setGate(null), GATE_RESET_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGate(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (gateRef.current && !gateRef.current.contains(e.target as Node)) {
        setGate(null);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [gate]);

  const live = useMemo(
    () =>
      props.actions.filter(
        (a) =>
          props.currentPly - a.ply_at < PROPOSAL_WINDOW_PLIES &&
          a.ply_at <= props.currentPly,
      ),
    [props.actions, props.currentPly],
  );
  const bySeat = (seat: Seat) =>
    props.seats.find((s) => s.seat === seat)?.userId;

  const resignProposalRaw = live.find((a) => a.kind === "resign_propose");
  const resignDeclined = live.some((a) => a.kind === "resign_decline");
  const resignProposal = resignDeclined ? undefined : resignProposalRaw;
  const resignProposerSeat = resignProposal
    ? props.seats.find((s) => s.userId === resignProposal.user_id)?.seat
    : undefined;
  const iAmResignPartner =
    resignProposerSeat !== undefined &&
    bySeat(partnerOf(resignProposerSeat)) === props.myUserId;

  const drawProposalRaw = live.find((a) => a.kind === "draw_propose");
  const drawDeclined = live.some((a) => a.kind === "draw_decline");
  const drawProposal = drawDeclined ? undefined : drawProposalRaw;
  const iAccepted = live.some(
    (a) =>
      (a.kind === "draw_accept" ||
        a.kind === "draw_propose" ||
        a.kind === "draw_decline") &&
      a.user_id === props.myUserId,
  );

  const idleDays = props.lastMoveAt
    ? (Date.now() - new Date(props.lastMoveAt).getTime()) / 86_400_000
    : 0;
  const abandonClaim = live.find((a) => a.kind === "abandon_claim");
  const absentIsMe = bySeat(props.activeSeat) === props.myUserId;

  const send = async (kind: string) => {
    setBusy(kind);
    setNote(null);
    const res = await fetch(`/api/games/${props.gameId}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setNote(body?.error ?? "That didn't land. Try again.");
    }
    setBusy(null);
    props.onChanged();
  };

  const chip =
    "rounded-full border border-line px-3 py-1 text-xs text-text-dim hover:bg-surface-raised disabled:opacity-50";

  return (
    <div className="mt-3 space-y-2">
      {/* Banners for live proposals */}
      {resignProposal && (
        <Banner>
          {resignProposerSeat !== undefined &&
            `${seatName(props, resignProposerSeat)} proposes the team resigns.`}
          {iAmResignPartner && (
            <span className="ml-2 inline-flex gap-2">
              <button
                className={chip}
                disabled={busy !== null}
                onClick={() => send("resign_confirm")}
              >
                Tip the kings
              </button>
              <button
                className={chip}
                disabled={busy !== null}
                onClick={() => send("resign_decline")}
              >
                Play on
              </button>
            </span>
          )}
        </Banner>
      )}
      {drawProposal && (
        <Banner>
          A draw is on the table — all four must agree.
          {!iAccepted && (
            <span className="ml-2 inline-flex gap-2">
              <button
                className={chip}
                disabled={busy !== null}
                onClick={() => send("draw_accept")}
              >
                Accept
              </button>
              <button
                className={chip}
                disabled={busy !== null}
                onClick={() => send("draw_decline")}
              >
                Decline
              </button>
            </span>
          )}
        </Banner>
      )}
      {abandonClaim && !absentIsMe && (
        <Banner>
          The table proposes closing this game as abandoned.
          <span className="ml-2 inline-flex gap-2">
            <button
              className={chip}
              disabled={busy !== null}
              onClick={() => send("abandon_agree")}
            >
              {/* Honest copy for the absent player's PARTNER: agreeing
                  concedes the game for the team (P1). */}
              {bySeat(partnerOf(props.activeSeat)) === props.myUserId
                ? "Concede for the team"
                : "Close it"}
            </button>
            {bySeat(partnerOf(props.activeSeat)) === props.myUserId && (
              <button
                className={chip}
                disabled={busy !== null}
                onClick={() => send("abandon_object")}
              >
                Keep it dormant
              </button>
            )}
          </span>
        </Banner>
      )}
      {note && (
        <p className="text-center text-xs text-[color:var(--danger)]">{note}</p>
      )}

      {/* Armed confirmation gates — loud, explicit, self-dissolving. */}
      {gate === "resign" && !resignProposal && (
        <div
          ref={gateRef}
          data-testid="resign-gate"
          role="alertdialog"
          aria-label="Confirm resignation"
          className="rounded-lg border-2 border-[color:var(--danger)] bg-surface-raised p-3 text-center"
        >
          <p className="text-sm font-semibold text-[color:var(--danger)]">
            Tip your king? This resigns for your whole team.
          </p>
          <p className="mt-0.5 text-xs text-text-dim">
            Your partner will be asked to agree before the kings fall.
          </p>
          <div className="mt-2 flex justify-center gap-2">
            <button
              className="rounded-full bg-[color:var(--danger)] px-4 py-1.5 text-xs font-bold text-[color:var(--ink)] disabled:opacity-50"
              disabled={busy !== null}
              onClick={() => {
                setGate(null);
                void send("resign_propose");
              }}
            >
              Yes — tip my king
            </button>
            <button
              className={chip}
              disabled={busy !== null}
              onClick={() => setGate(null)}
            >
              Never mind
            </button>
          </div>
        </div>
      )}
      {gate === "draw" && !drawProposal && (
        <div
          ref={gateRef}
          data-testid="draw-gate"
          role="alertdialog"
          aria-label="Confirm draw offer"
          className="rounded-lg border-2 border-[color:var(--focus-ring)] bg-surface-raised p-3 text-center"
        >
          <p className="text-sm font-semibold text-text">
            Offer a draw to the table?
          </p>
          <p className="mt-0.5 text-xs text-text-dim">
            All four players must agree.
          </p>
          <div className="mt-2 flex justify-center gap-2">
            <button
              className="rounded-full bg-[color:var(--focus-ring)] px-4 py-1.5 text-xs font-bold text-[color:var(--ink)] disabled:opacity-50"
              disabled={busy !== null}
              onClick={() => {
                setGate(null);
                void send("draw_propose");
              }}
            >
              Yes — offer the draw
            </button>
            <button
              className={chip}
              disabled={busy !== null}
              onClick={() => setGate(null)}
            >
              Never mind
            </button>
          </div>
        </div>
      )}

      {/* Quiet action row */}
      <div className="flex flex-wrap justify-center gap-2">
        {!resignProposal && gate !== "resign" && (
          <button
            className={chip}
            disabled={busy !== null}
            onClick={() => setGate("resign")}
            title="Your partner will be asked to confirm"
          >
            Tip your king…
          </button>
        )}
        {!drawProposal && gate !== "draw" && (
          <button
            className={chip}
            disabled={busy !== null}
            onClick={() => setGate("draw")}
          >
            Offer a draw…
          </button>
        )}
        {(props.draws.threefold || props.draws.fiftyMove) && (
          <button
            className={`${chip} border-[color:var(--halo)]`}
            disabled={busy !== null}
            onClick={() => send("draw_claim")}
          >
            Claim the draw (
            {props.draws.threefold ? "threefold" : "fifty-move"})
          </button>
        )}
        {props.activeSeat !== props.mySeat && idleDays >= 1 && (
          <button
            className={chip}
            disabled={busy !== null}
            onClick={() => send("nudge")}
          >
            Give them a poke
          </button>
        )}
        {props.activeSeat !== props.mySeat &&
          idleDays >= 14 &&
          !abandonClaim && (
            <button
              className={chip}
              disabled={busy !== null}
              onClick={() => send("abandon_claim")}
            >
              Close as abandoned?
            </button>
          )}
      </div>
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface-raised p-3 text-center text-sm text-text">
      {children}
    </div>
  );
}

function seatName(props: EndGameActionsProps, seat: Seat): string {
  return props.seats.find((s) => s.seat === seat)?.displayName ?? "A player";
}
