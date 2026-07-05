"use client";

/**
 * VictoryOverlay — the moment the game is won. A presentational card raised
 * over the board once its ceremony has had a beat to breathe: the winning
 * team's colors, a crown, the headline, and the "clever context" line
 * (who mated whom, with what, on which turn) derived upstream in victory.ts.
 *
 * Dumb by design: it takes a VictoryContext and two slots — `tally` (the
 * online series count) and `actions` (page-specific buttons) — so hotseat and
 * the online room show one identical moment. "View the final board" collapses
 * it to a slim banner so the finished position stays readable. Sound-ready:
 * a victory cue can fire on entrance (task #6) where noted; none plays yet.
 */
import { useEffect, useState, type ReactNode } from "react";
import type { Team } from "@rotochess/engine";
import type { VictoryContext } from "@/lib/game/victory";
import { playCue } from "@/lib/audio/engine";

/** The winning team's two hues, left→right; a muted parchment sweep for draws. */
const TEAM_BAND: Record<Team, string> = {
  1: "linear-gradient(90deg, var(--north-red-bright), var(--south-blue-bright))",
  2: "linear-gradient(90deg, var(--east-black-bright), var(--west-gold-bright))",
};
const DRAW_BAND =
  "linear-gradient(90deg, var(--west-gold-strong), var(--focus-ring))";

function Crown() {
  // A five-point crown; the fill inherits currentColor so the band tint reads.
  return (
    <svg
      viewBox="0 0 48 36"
      width="44"
      height="33"
      aria-hidden="true"
      className="crown-glint drop-shadow"
    >
      <path
        d="M3 30 L6 11 L16 20 L24 6 L32 20 L42 11 L45 30 Z"
        fill="currentColor"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <rect x="3" y="30" width="42" height="4.5" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function VictoryOverlay({
  context,
  actions,
  tally,
  /** Delay before the card rises, letting the board ceremony land first. */
  enterDelayMs = 700,
}: {
  context: VictoryContext;
  actions?: ReactNode;
  tally?: ReactNode;
  enterDelayMs?: number;
}) {
  const [shown, setShown] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShown(true), enterDelayMs);
    return () => clearTimeout(t);
  }, [enterDelayMs]);

  // The victory/draw cue fires once, as the card first appears.
  useEffect(() => {
    if (!shown) return;
    playCue(context.winningTeam ? "victory" : "draw");
  }, [shown, context.winningTeam]);

  if (!shown) return null;

  const band = context.winningTeam ? TEAM_BAND[context.winningTeam] : DRAW_BAND;

  if (collapsed) {
    // Slim banner: the verdict stays present without hiding the final board.
    return (
      <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 rounded-full border border-line bg-surface-raised/95 px-4 py-2 text-sm text-text shadow-lg backdrop-blur"
        >
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: band }}
          />
          <span style={{ fontFamily: "var(--font-instrument-serif)" }}>
            {context.headline}
          </span>
          <span className="text-text-dim">· Show result</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="victory-scrim fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Game result"
      data-testid="victory-overlay"
    >
      <div className="victory-card w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-2xl">
        {/* Winner band + crown */}
        <div
          className="flex items-center justify-center py-5 text-[color:var(--ink)]"
          style={{ background: band }}
        >
          <Crown />
        </div>

        <div className="px-6 pb-6 pt-5 text-center">
          <h2
            className="text-3xl text-text"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
            data-testid="victory-headline"
          >
            {context.headline}
          </h2>

          {context.winnerLine && (
            <p
              className="mt-1 text-lg text-text"
              style={{ fontFamily: "var(--font-instrument-sans)" }}
            >
              {context.winnerLine}
            </p>
          )}

          <p className="mt-3 text-sm leading-relaxed text-text-dim">
            {context.detail}
          </p>

          {tally && <div className="mt-4">{tally}</div>}

          {actions && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {actions}
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="mt-4 text-xs text-text-dim underline-offset-2 hover:text-text hover:underline"
          >
            View the final board
          </button>
        </div>
      </div>
    </div>
  );
}
