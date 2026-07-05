"use client";

/**
 * The pawn reaches the far rank — choose its new rank. Shown in place of the
 * cramped "=Q =R =B =N" pills: four real, seat-colored piece figures as large
 * tap targets, named beneath, with the chosen one lit in the seat's color.
 * A promotion is a genuine fork in the game, so it deserves to look like one.
 *
 * The buttons keep the `opt-{kind}-{rotDir}` testids the e2e golden relies on.
 */
import type { Move, PromotionKind, Seat } from "@rotochess/engine";

const SEAT_BG: Record<Seat, string> = {
  1: "var(--north-red-bright)",
  2: "var(--east-black-bright)",
  3: "var(--south-blue-bright)",
  4: "var(--west-gold-bright)",
};

/** Canonical order, strongest first — matches how players think about it. */
const PROMOTION_ORDER: readonly PromotionKind[] = ["Q", "R", "B", "N"];
const PROMOTION_NAME: Record<PromotionKind, string> = {
  Q: "Queen",
  R: "Rook",
  B: "Bishop",
  N: "Knight",
};

export function PromotionPicker({
  seat,
  options,
  selected,
  onChoose,
}: {
  seat: Seat;
  /** The pending moves, one (or more) per promotion kind. */
  options: readonly Move[];
  selected: Move | null;
  onChoose: (m: Move) => void;
}) {
  // First move per kind, in canonical order (pawns don't carry rotational
  // route variants, so one move per kind is the whole story).
  const byKind = new Map<PromotionKind, Move>();
  for (const m of options) {
    if (m.promotion && !byKind.has(m.promotion)) byKind.set(m.promotion, m);
  }
  const tiles = PROMOTION_ORDER.flatMap((kind) => {
    const move = byKind.get(kind);
    return move ? [{ kind, move }] : [];
  });

  return (
    <div className="mt-1">
      <p className="mb-1.5 text-xs uppercase tracking-wide text-text-dim">
        Promote to
      </p>
      <div className="grid grid-cols-4 gap-2">
        {tiles.map(({ kind, move }) => {
          const active = selected?.promotion === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onChoose(move)}
              aria-pressed={active}
              aria-label={`Promote to ${PROMOTION_NAME[kind]}`}
              data-testid={`opt-${kind}-${move.rotDir ?? 0}`}
              className={`flex flex-col items-center gap-1 rounded-lg border-2 px-1 py-2 transition ${
                active
                  ? "bg-surface-raised"
                  : "border-line bg-surface hover:border-text-dim"
              }`}
              style={active ? { borderColor: SEAT_BG[seat] } : undefined}
            >
              <img
                src={`/pieces/${seat}${kind}.svg`}
                alt=""
                aria-hidden
                width={40}
                height={40}
                className={active ? "" : "opacity-80"}
                draggable={false}
              />
              <span
                className={`text-xs ${active ? "font-semibold text-text" : "text-text-dim"}`}
              >
                {PROMOTION_NAME[kind]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
