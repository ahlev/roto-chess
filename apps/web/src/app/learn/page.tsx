"use client";

/**
 * The First Orbit — five interactive beats, ~3 minutes, deltas-from-chess
 * only. Skippable at every step, replayable from the menu. Everything the
 * boards show is engine-true.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { DemoBoard } from "@/components/board/DemoBoard";
import { demoState } from "@/lib/game/demo-positions";

const BEATS = [
  {
    title: "This is a chessboard bent into a ring.",
    body: "Four files run A (inner) to D (outer); thirty-two ranks run clockwise, and rank 32 borders rank 1. Tap the rook — its file-wise slide wraps straight through the seam. Coordinates are letter-first: D32, A1. They never change, no matter how the board turns.",
  },
  {
    title: "Four armies. Two teams. Partners opposite.",
    body: "You and the player across from you are a team — red & blue against black & gold. Play runs clockwise, and checkmating EITHER opponent wins it for your team. The four red lines are meridians; the one through your camp is yours.",
  },
  {
    title: "Pawns go both ways.",
    body: "Tap each pawn. They march AWAY from your meridian — half clockwise, half counter — and promote on the opposing back rank they reach. This one image is most of what confuses chess players; you now have it.",
  },
  {
    title: "Bishops ride the curl.",
    body: "Tap the bishop. On a circle, a diagonal is a banana curl — the bishop follows its color chain around the bend, and once per move it may bounce off a rail and keep going. It never leaves its color.",
  },
  {
    title: "Earn your way home.",
    body: "Tap the knight by your meridian. Rooks, bishops, and knights cross their OWN meridian only with a halo — earned by any capture, or by reaching an enemy back rank. Cross without one and the piece completes its move… then evaporates. The second board shows the same knight, haloed: home is open, forever.",
  },
] as const;

export default function LearnPage() {
  const [beat, setBeat] = useState(0);

  const boards = useMemo(
    () => [
      demoState([{ at: "5B", kind: "R", seat: 1, hasMoved: true }]),
      null, // beat 2 uses the plain initial-ish frame below
      demoState([
        { at: "2B", kind: "P", seat: 1 },
        { at: "31B", kind: "P", seat: 1 },
      ]),
      demoState([{ at: "5B", kind: "B", seat: 1, hasMoved: true }]),
      demoState([
        { at: "2B", kind: "N", seat: 1, hasMoved: true, origin: "1C" },
      ]),
    ],
    [],
  );
  const haloBoard = useMemo(
    () =>
      demoState([
        { at: "2B", kind: "N", seat: 1, halo: true, hasMoved: true, origin: "1C" },
      ]),
    [],
  );
  const teamsBoard = useMemo(() => demoState([]), []);

  const current = BEATS[beat];
  if (!current) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-4 pb-12">
      <SiteHeader links={[{ href: "/hotseat", label: "Skip to the board" }]} />

      <div className="flex items-center gap-1 pb-2" role="group" aria-label="Progress">
        {BEATS.map((b, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setBeat(i)}
            aria-label={`Go to step ${i + 1}: ${b.title}`}
            aria-current={i === beat ? "step" : undefined}
            className="flex-1 rounded-full py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
          >
            <span
              className={`block h-1.5 rounded-full ${
                i <= beat ? "bg-[color:var(--focus-ring)]" : "bg-surface-raised"
              }`}
            />
          </button>
        ))}
      </div>

      <h1
        className="text-2xl text-text"
        style={{ fontFamily: "var(--font-instrument-serif)" }}
      >
        {current.title}
      </h1>
      <p className="pt-2 text-sm leading-relaxed text-text-dim">
        {current.body}
      </p>

      <div className="mx-auto w-full max-w-md py-4">
        {beat === 1 ? (
          <DemoBoard
            state={teamsBoard}
            caption="Red & Blue (N–S) against Black & Gold (E–W)."
          />
        ) : beat === 4 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DemoBoard
              state={boards[4]!}
              caption="No halo: crossing evaporates."
            />
            <DemoBoard state={haloBoard} caption="Haloed: cross freely." />
          </div>
        ) : (
          boards[beat] && <DemoBoard state={boards[beat]!} />
        )}
      </div>

      <div className="mt-auto flex justify-between pt-4">
        <button
          type="button"
          disabled={beat === 0}
          onClick={() => setBeat((b) => Math.max(0, b - 1))}
          className="rounded-full border border-line px-4 py-2 text-sm text-text-dim disabled:opacity-40"
        >
          Back
        </button>
        {beat < BEATS.length - 1 ? (
          <button
            type="button"
            onClick={() => setBeat((b) => b + 1)}
            className="rounded-full bg-[color:var(--focus-ring)] px-5 py-2 text-sm font-semibold text-[color:var(--ink)]"
            data-testid="next-beat"
          >
            Next
          </button>
        ) : (
          <Link
            href="/hotseat"
            className="rounded-full bg-[color:var(--focus-ring)] px-5 py-2 text-sm font-semibold text-[color:var(--ink)]"
          >
            Take a seat
          </Link>
        )}
      </div>
    </main>
  );
}
