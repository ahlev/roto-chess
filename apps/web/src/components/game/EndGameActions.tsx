"use client";

/**
 * The game-end machinery, presented gently: resign (partner confirms),
 * draw offer (all four), rule claims when the engine says they exist,
 * abandonment door when the board has been silent, and the human nudge.
 */
import { useMemo, useState } from "react";
import { partnerOf, type Seat } from "@rotochess/engine";

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

export function EndGameActions(props: EndGameActionsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const live = useMemo(
    () => props.actions.filter((a) => a.ply_at === props.currentPly),
    [props.actions, props.currentPly],
  );
  const bySeat = (seat: Seat) =>
    props.seats.find((s) => s.seat === seat)?.userId;

  const resignProposal = live.find((a) => a.kind === "resign_propose");
  const resignProposerSeat = resignProposal
    ? props.seats.find((s) => s.userId === resignProposal.user_id)?.seat
    : undefined;
  const iAmResignPartner =
    resignProposerSeat !== undefined &&
    bySeat(partnerOf(resignProposerSeat)) === props.myUserId;

  const drawProposal = live.find((a) => a.kind === "draw_propose");
  const iAccepted = live.some(
    (a) =>
      (a.kind === "draw_accept" || a.kind === "draw_propose") &&
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
              Close it
            </button>
            <button
              className={chip}
              disabled={busy !== null}
              onClick={() => send("abandon_object")}
            >
              Keep it dormant
            </button>
          </span>
        </Banner>
      )}
      {note && (
        <p className="text-center text-xs text-[color:var(--danger)]">{note}</p>
      )}

      {/* Quiet action row */}
      <div className="flex flex-wrap justify-center gap-2">
        {!resignProposal && (
          <button
            className={chip}
            disabled={busy !== null}
            onClick={() => send("resign_propose")}
            title="Your partner will be asked to confirm"
          >
            Tip your king…
          </button>
        )}
        {!drawProposal && (
          <button
            className={chip}
            disabled={busy !== null}
            onClick={() => send("draw_propose")}
          >
            Offer a draw
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
