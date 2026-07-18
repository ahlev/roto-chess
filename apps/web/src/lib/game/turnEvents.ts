/**
 * Event-feedback derivation — what the LAST committed turn did, for every
 * viewer: board-effect squares (halo bloom, evaporation, Avenger), the
 * dissolving MOVER's sprite (the board state has already lost it), and
 * captions that make the invisible rules (§6.2–§6.4) self-explaining to
 * opponents and observers.
 *
 * Same fold as the captures tray: the game IS initialState + turns, so the
 * pre-turn position is replayed mechanically, giving the mover's identity
 * even for a piece the meridian claimed. Pure; throws on a record that does
 * not replay.
 *
 * MIXED-SIGNAL RULE (shared by visuals, captions, and sound): a piece that
 * earns a halo and evaporates on the same move gets NO halo celebration —
 * the evaporation owns the moment (§6.3: the just-earned halo never saves
 * it, so celebrating it misleads, which is exactly what confused the July
 * tester).
 */

import {
  applySubmove,
  initialBoard,
  initialState,
  type BoardState,
  type PieceKind,
  type Seat,
  type Square,
  type Turn,
} from "@rotochess/engine";

export interface EventGhost {
  square: Square;
  kind: PieceKind;
  seat: Seat;
}

export interface EventCaptionData {
  key: string;
  tone: "halo" | "evaporation" | "avenger";
  text: string;
}

export interface TurnFeedback {
  /** Pieces that earned a halo AND survived — the gold ring inscribes. */
  bloomSquares: readonly Square[];
  /** Squares where the mover evaporated — dissolve + motes. */
  evaporateSquares: readonly Square[];
  /** The evaporated MOVER's sprite per square (not the capture victim). */
  evaporateGhosts: readonly EventGhost[];
  /** Grave squares where an Avenger landed — red shockwave. */
  avengerSquares: readonly Square[];
  /** Full crossing path per Avenger move, from-square first — red trail. */
  avengerPaths: readonly (readonly Square[])[];
  captions: readonly EventCaptionData[];
}

/** Shared empty result — callers can identity-compare against it. */
export const EMPTY_FEEDBACK: TurnFeedback = {
  bloomSquares: [],
  evaporateSquares: [],
  evaporateGhosts: [],
  avengerSquares: [],
  avengerPaths: [],
  captions: [],
};

export const SEAT_NAME: Record<Seat, string> = {
  1: "North",
  2: "East",
  3: "South",
  4: "West",
};

const KIND_NAME: Record<PieceKind, string> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
  P: "pawn",
};

/** Game-start layout, for naming the fallen piece an Avenger avenges. */
const INITIAL = initialBoard();

/** Derive the feedback for the LAST turn of a committed turn list. */
export function turnFeedback(
  turns: readonly Turn[],
  initial: BoardState = initialState(),
): TurnFeedback {
  const last = turns.at(-1);
  if (!last) return EMPTY_FEEDBACK;

  // Replay to the position the last turn was played FROM.
  let state = initial;
  for (let i = 0; i < turns.length - 1; i++) {
    for (const move of (turns[i] as Turn).submoves) {
      state = applySubmove(state, move);
    }
  }

  const bloomSquares: Square[] = [];
  const evaporateSquares: Square[] = [];
  const evaporateGhosts: EventGhost[] = [];
  const avengerSquares: Square[] = [];
  const avengerPaths: (readonly Square[])[] = [];
  const captions: EventCaptionData[] = [];
  const keyBase = turns.length;

  for (const move of last.submoves) {
    const mover = state.board[move.from];
    const victim =
      move.captures !== undefined ? state.board[move.captures] : null;
    if (mover) {
      const who = SEAT_NAME[mover.seat];
      const piece = KIND_NAME[mover.kind];
      if (move.earnsHalo && !move.evaporates) {
        bloomSquares.push(move.to);
      }
      if (move.avenger) {
        avengerSquares.push(move.to);
        avengerPaths.push([move.from, ...move.path]);
        const fallen = INITIAL[move.to];
        const fallenName = fallen ? KIND_NAME[fallen.kind] : "piece";
        const victimName = victim ? KIND_NAME[victim.kind] : "intruder";
        captions.push({
          key: `${keyBase}-${move.to}-avenger`,
          tone: "avenger",
          text: `${who}'s ${piece} avenges the fallen ${fallenName} — takes the ${victimName} and crosses penalty-free.`,
        });
      } else if (move.earnsHalo && !move.evaporates) {
        captions.push({
          key: `${keyBase}-${move.to}-halo`,
          tone: "halo",
          text: `${who}'s ${piece} earns its halo — the meridian is open to it, forever.`,
        });
      }
      if (move.evaporates) {
        evaporateSquares.push(move.to);
        evaporateGhosts.push({
          square: move.to,
          kind: mover.kind,
          seat: mover.seat,
        });
        captions.push({
          key: `${keyBase}-${move.to}-evaporation`,
          tone: "evaporation",
          text: victim
            ? `${who}'s ${piece} takes the ${KIND_NAME[victim.kind]}, then evaporates — the meridian claims it.`
            : `${who}'s ${piece} crosses its own meridian unhaloed — evaporated.`,
        });
      }
    }
    state = applySubmove(state, move);
  }

  if (
    bloomSquares.length === 0 &&
    evaporateSquares.length === 0 &&
    avengerSquares.length === 0
  ) {
    return EMPTY_FEEDBACK;
  }
  return {
    bloomSquares,
    evaporateSquares,
    evaporateGhosts,
    avengerSquares,
    avengerPaths,
    captions,
  };
}
