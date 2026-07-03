"use client";

/**
 * Seat plaques — who occupies each seat, presented as four clean plaques
 * grouped into their partnerships (N+S vs E+W share a bordered pair rail,
 * so the teams read at a glance). The ACTIVE seat's plaque is unmistakable:
 * seat-colored border, raised weight, and an underline bar in the seat
 * color — steady emphasis, never a pulse.
 */
import { SEAT_COMPASS, type Seat } from "@rotochess/engine";

export interface PlaqueSeat {
  seat: Seat;
  userId: string;
  displayName: string;
}

const SEAT_TEXT: Record<Seat, string> = {
  1: "text-[color:var(--north-red-bright)]",
  2: "text-[color:var(--east-black-bright)]",
  3: "text-[color:var(--south-blue-bright)]",
  4: "text-[color:var(--west-gold-bright)]",
};

export const SEAT_CHIP: Record<Seat, string> = {
  1: "bg-[color:var(--north-red-bright)]",
  2: "bg-[color:var(--east-black-bright)]",
  3: "bg-[color:var(--south-blue-bright)]",
  4: "bg-[color:var(--west-gold-bright)]",
};

const SEAT_BORDER: Record<Seat, string> = {
  1: "border-[color:var(--north-red-bright)]",
  2: "border-[color:var(--east-black-bright)]",
  3: "border-[color:var(--south-blue-bright)]",
  4: "border-[color:var(--west-gold-bright)]",
};

export function SeatPlaques({
  seats,
  mySeat,
  activeSeat,
  vacantHint = "open",
  onSeatClick,
}: {
  seats: PlaqueSeat[];
  mySeat: Seat | null;
  activeSeat: Seat | null;
  /** Copy for an unfilled seat (the lobby says "open — send the link"). */
  vacantHint?: string;
  /** Occupied plaques become buttons when provided (chat routing). */
  onSeatClick?: (seat: Seat) => void;
}) {
  const bySeat = (seat: Seat) => seats.find((s) => s.seat === seat);

  // Partners as pairs: 1+3 (North/South) vs 2+4 (East/West). Each pair
  // shares one subtle rail so the teams group visually.
  const pairs: Array<readonly [Seat, Seat]> = [
    [1, 3],
    [2, 4],
  ];

  return (
    <div className="grid grid-cols-2 gap-2" data-testid="seat-plaques">
      {pairs.map(([a, b]) => (
        <div
          key={a}
          className="grid grid-cols-2 gap-1 rounded-xl border border-line/60 bg-surface p-1"
        >
          <Plaque
            seat={a}
            info={bySeat(a)}
            mySeat={mySeat}
            activeSeat={activeSeat}
            vacantHint={vacantHint}
            onSeatClick={onSeatClick}
          />
          <Plaque
            seat={b}
            info={bySeat(b)}
            mySeat={mySeat}
            activeSeat={activeSeat}
            vacantHint={vacantHint}
            onSeatClick={onSeatClick}
          />
        </div>
      ))}
    </div>
  );
}

function Plaque({
  seat,
  info,
  mySeat,
  activeSeat,
  vacantHint,
  onSeatClick,
}: {
  seat: Seat;
  info: PlaqueSeat | undefined;
  mySeat: Seat | null;
  activeSeat: Seat | null;
  vacantHint: string;
  onSeatClick?: ((seat: Seat) => void) | undefined;
}) {
  const active = activeSeat === seat;
  const clickable = info !== undefined && onSeatClick !== undefined;

  const frame = active
    ? `border-2 ${SEAT_BORDER[seat]} bg-surface-raised`
    : info
      ? "border border-line bg-surface-raised/50"
      : "border border-dashed border-line/70";

  const body = (
    <>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={`h-2 w-2 shrink-0 rounded-full ${SEAT_CHIP[seat]}`}
        />
        <span
          className={`text-[11px] ${SEAT_TEXT[seat]} ${
            active ? "font-bold" : "font-semibold"
          }`}
          style={{ fontFamily: "var(--font-plex-mono)" }}
        >
          {SEAT_COMPASS[seat]}
        </span>
        {seat === mySeat && (
          <span className="rounded-full border border-line px-1 text-[9px] uppercase tracking-wide text-text-dim">
            you
          </span>
        )}
      </span>
      <span
        className={`block truncate text-xs ${
          info
            ? active
              ? "font-semibold text-text"
              : "text-text"
            : "italic text-text-dim"
        }`}
      >
        {info ? info.displayName : vacantHint}
      </span>
      {/* Active underline bar — the unmistakable "this seat moves now". */}
      <span
        aria-hidden
        className={`mt-1 block h-0.5 rounded-full ${
          active ? SEAT_CHIP[seat] : "bg-transparent"
        }`}
      />
    </>
  );

  const className = `min-w-0 rounded-lg px-2 py-1.5 text-left ${frame}`;

  if (clickable) {
    return (
      <button
        type="button"
        data-testid={`seat-plaque-${seat}`}
        className={`${className} cursor-pointer hover:bg-surface-raised`}
        onClick={() => onSeatClick(seat)}
        aria-label={`${info.displayName}, seat ${SEAT_COMPASS[seat]}${
          active ? ", to move" : ""
        }`}
      >
        {body}
      </button>
    );
  }
  return (
    <div data-testid={`seat-plaque-${seat}`} className={className}>
      {body}
    </div>
  );
}
