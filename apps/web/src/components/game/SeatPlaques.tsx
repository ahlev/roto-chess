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
  // shares one labeled rail so the teams read at a glance.
  const pairs: Array<{ seats: readonly [Seat, Seat]; label: string }> = [
    { seats: [1, 3], label: "Red & Blue" },
    { seats: [2, 4], label: "Black & Gold" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2" data-testid="seat-plaques">
      {pairs.map(({ seats: [a, b], label }) => {
        // The team whose turn it is gets a brighter rail so the whole
        // partnership — not just one seat — reads as "up now".
        const teamActive = activeSeat === a || activeSeat === b;
        return (
          <div
            key={a}
            className={`flex flex-col gap-1 rounded-xl border bg-surface p-1.5 ${
              teamActive ? "border-line" : "border-line/40"
            }`}
          >
            <span
              className={`px-1 text-[10px] uppercase tracking-wide ${
                teamActive ? "font-semibold text-text" : "text-text-dim"
              }`}
              style={{ fontFamily: "var(--font-plex-mono)" }}
            >
              {label}
              {teamActive && (
                <span className="ml-1 font-normal text-text-dim">· to move</span>
              )}
            </span>
            <div className="grid grid-cols-2 gap-1">
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
          </div>
        );
      })}
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
    ? `border-2 ${SEAT_BORDER[seat]} bg-surface-raised shadow-sm`
    : info
      ? "border border-line/70 bg-surface-raised/40"
      : "border border-dashed border-line/60";

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
              ? "font-bold text-text"
              : "text-text"
            : "italic text-text-dim"
        }`}
      >
        {info ? info.displayName : vacantHint}
      </span>
      {/* Active seat-color bar — the unmistakable "this seat moves now".
          Thicker + full-color on the active plaque; a hairline rest elsewhere. */}
      <span
        aria-hidden
        className={`mt-1 block rounded-full ${
          active ? `h-1 ${SEAT_CHIP[seat]}` : "h-px bg-line/40"
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
