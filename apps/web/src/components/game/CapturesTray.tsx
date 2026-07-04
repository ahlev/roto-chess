"use client";

/**
 * CapturesTray — the club secretary's ledger of the fallen. A slim tray
 * below the board, two rows, one per partnership's LOSSES. Each fallen
 * piece renders as its own small glyph (the same baked sprites the board
 * uses), sorted by value, with a tiny corner dot in the CAPTOR's seat
 * color — or an ash-teal mote (a diamond, never a captor's round dot)
 * when the meridian claimed it (§6.3), captured by nobody. Renders
 * nothing at all until the first piece falls.
 */

import { useMemo } from "react";
import {
  teamOf,
  type Move,
  type PieceKind,
  type Seat,
  type Turn,
} from "@rotochess/engine";
import {
  fallenLabel,
  fallenPieces,
  type FallenPiece,
} from "@/lib/game/captures";

/** Display order within a row: heaviest loss first. Kings never fall. */
const VALUE_ORDER: Record<PieceKind, number> = {
  Q: 0,
  R: 1,
  B: 2,
  N: 3,
  P: 4,
  K: 5,
};

const SEAT_DOT: Record<Seat, string> = {
  1: "var(--north-red-bright)",
  2: "var(--east-black-bright)",
  3: "var(--south-blue-bright)",
  4: "var(--west-gold-bright)",
};

export function CapturesTray({
  turns,
  staged = null,
}: {
  turns: readonly Turn[];
  /** The in-progress turn's already-placed submove (opening's first move),
   *  so a piece it took shows in the ledger the instant it falls. */
  staged?: Move | null;
}) {
  const fallen = useMemo(() => {
    // The committed turns are canonical — a piece recorded here has truly
    // fallen and must stay on the ledger.
    let committed: FallenPiece[];
    try {
      committed = fallenPieces(turns);
    } catch {
      // A committed record that won't replay is surfaced loudly elsewhere;
      // the ledger stays closed rather than show a half-truth.
      return [];
    }
    if (!staged) return committed;
    // The in-progress submove is best-effort. If it doesn't cohere with the
    // committed turns (the two can momentarily disagree while state settles),
    // keep the committed ledger — never blank a genuinely fallen piece for a
    // transient staged inconsistency.
    try {
      return fallenPieces(turns, undefined, [staged]);
    } catch {
      return committed;
    }
  }, [turns, staged]);

  if (fallen.length === 0) return null;

  const rows = (
    [
      { team: 1, label: "Red & Blue" },
      { team: 2, label: "Black & Gold" },
    ] as const
  ).map((row) => ({
    ...row,
    items: [...fallen]
      .filter((f) => teamOf(f.ownerSeat) === row.team)
      .sort(
        (a, b) => VALUE_ORDER[a.kind] - VALUE_ORDER[b.kind] || a.ply - b.ply,
      ),
  }));

  return (
    <div
      data-testid="captures-tray"
      role="group"
      aria-label="The fallen"
      className="mt-3 rounded-lg border border-line/60 bg-surface px-2.5 py-1"
    >
      {rows.map((row) => (
        <div key={row.team} className="flex items-center gap-2 py-1">
          <span
            className="w-[5.5rem] shrink-0 text-[10px] uppercase tracking-wide text-text-dim"
            style={{ fontFamily: "var(--font-plex-mono)" }}
          >
            {row.label}
          </span>
          {row.items.length === 0 ? (
            <span className="text-[10px] italic text-text-dim/70">
              all pieces standing
            </span>
          ) : (
            <ul
              aria-label={`Pieces fallen from ${row.label}`}
              className="flex flex-wrap items-center gap-x-1.5 gap-y-1"
            >
              {row.items.map((f, i) => (
                <FallenGlyph key={i} fallen={f} />
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function FallenGlyph({ fallen }: { fallen: FallenPiece }) {
  const label = fallenLabel(fallen);
  return (
    <li className="relative" title={label} aria-label={label}>
      <img
        src={`/pieces/${fallen.ownerSeat}${fallen.kind}.svg`}
        alt=""
        width={22}
        height={22}
        className="block h-[22px] w-[22px]"
        draggable={false}
      />
      {fallen.by === "evaporated" ? (
        // The meridian's claim: an ash mote — diamond form, never a
        // captor's round dot (form first, hue second).
        <span
          aria-hidden
          className="absolute -right-0.5 top-0 h-1.5 w-1.5 rotate-45"
          style={{
            background: "var(--evaporate)",
            boxShadow: "0 0 0 1px var(--surface)",
          }}
        />
      ) : (
        <span
          aria-hidden
          className="absolute -right-0.5 top-0 h-2 w-2 rounded-full"
          style={{
            background: SEAT_DOT[fallen.by],
            boxShadow: "0 0 0 1px var(--surface)",
          }}
        />
      )}
    </li>
  );
}
