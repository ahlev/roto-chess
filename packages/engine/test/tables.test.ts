/**
 * M1 verification — the rulebook's tables, transcribed a SECOND time here
 * (independently of src) and compared against the geometry module. This
 * guards against transcription typos, the most likely failure mode.
 */
import { describe, expect, it } from "vitest";
import {
  MERIDIAN_CW_START,
  SEATS,
  type Seat,
  backRanks,
  formatSquare,
  meridianSide,
  nextSeat,
  parseSquare,
  partnerOf,
  pawnDirection,
  prevSeat,
  promotionRank,
  quadrantOwner,
  seatSetup,
  spanCrossesOwnMeridian,
  squareOf,
  stepCrossesOwnMeridian,
  teamOf,
  wrapRank,
} from "../src/index.js";

/** display rank → internal rank */
const d = (displayRank: number) => displayRank - 1;

describe("teams and turn order (§1.1, §4.1)", () => {
  it("seats 1,3 form one team; 2,4 the other; partners sit opposite", () => {
    expect(teamOf(1)).toBe(1);
    expect(teamOf(3)).toBe(1);
    expect(teamOf(2)).toBe(2);
    expect(teamOf(4)).toBe(2);
    expect(partnerOf(1)).toBe(3);
    expect(partnerOf(3)).toBe(1);
    expect(partnerOf(2)).toBe(4);
    expect(partnerOf(4)).toBe(2);
  });

  it("play proceeds clockwise 1→2→3→4→1", () => {
    expect(nextSeat(1)).toBe(2);
    expect(nextSeat(2)).toBe(3);
    expect(nextSeat(3)).toBe(4);
    expect(nextSeat(4)).toBe(1);
  });
});

describe("quadrant ownership (§2.3) — transcribed verbatim", () => {
  // Player 1 (North): ranks 29,30,31,32,1,2,3,4
  // Player 2 (East):  ranks 5–12
  // Player 3 (South): ranks 13–20
  // Player 4 (West):  ranks 21–28
  const expected: Record<number, Seat> = {};
  for (const r of [29, 30, 31, 32, 1, 2, 3, 4]) expected[r] = 1;
  for (let r = 5; r <= 12; r++) expected[r] = 2;
  for (let r = 13; r <= 20; r++) expected[r] = 3;
  for (let r = 21; r <= 28; r++) expected[r] = 4;

  it("matches for every one of the 32 ranks", () => {
    for (let display = 1; display <= 32; display++) {
      expect(quadrantOwner(d(display)), `rank ${display}`).toBe(
        expected[display],
      );
    }
  });
});

describe("meridian sides (§2.3, §2.8)", () => {
  it("North meridian: display 1–16 clockwise side, 17–32 counterclockwise", () => {
    for (let display = 1; display <= 16; display++) {
      expect(meridianSide(1, d(display)), `rank ${display}`).toBe("cw");
    }
    for (let display = 17; display <= 32; display++) {
      expect(meridianSide(1, d(display)), `rank ${display}`).toBe("ccw");
    }
  });

  it("East meridian: display 9–24 clockwise side, 25–8 counterclockwise", () => {
    for (let display = 9; display <= 24; display++) {
      expect(meridianSide(2, d(display)), `rank ${display}`).toBe("cw");
    }
    for (const display of [25, 26, 27, 28, 29, 30, 31, 32, 1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(meridianSide(2, d(display)), `rank ${display}`).toBe("ccw");
    }
  });

  it("crossing detection at each seat's own boundary", () => {
    // North boundary between display 32 and 1 (internal 31|0)
    expect(stepCrossesOwnMeridian(1, d(32), 1)).toBe(true);
    expect(stepCrossesOwnMeridian(1, d(1), -1)).toBe(true);
    expect(stepCrossesOwnMeridian(1, d(1), 1)).toBe(false);
    expect(stepCrossesOwnMeridian(1, d(16), 1)).toBe(false); // south boundary ≠ own
    // East between 8 and 9
    expect(stepCrossesOwnMeridian(2, d(8), 1)).toBe(true);
    expect(stepCrossesOwnMeridian(2, d(9), -1)).toBe(true);
    // South between 16 and 17
    expect(stepCrossesOwnMeridian(3, d(16), 1)).toBe(true);
    expect(stepCrossesOwnMeridian(3, d(17), -1)).toBe(true);
    // West between 24 and 25
    expect(stepCrossesOwnMeridian(4, d(24), 1)).toBe(true);
    expect(stepCrossesOwnMeridian(4, d(25), -1)).toBe(true);
  });
});

describe("back ranks, pawn ranks, K/Q placement (§2.5–2.7) — transcribed verbatim", () => {
  it("back ranks flank each meridian", () => {
    expect(new Set(backRanks(1))).toEqual(new Set([d(32), d(1)]));
    expect(new Set(backRanks(2))).toEqual(new Set([d(8), d(9)]));
    expect(new Set(backRanks(3))).toEqual(new Set([d(16), d(17)]));
    expect(new Set(backRanks(4))).toEqual(new Set([d(24), d(25)]));
  });

  it("pawn ranks sit immediately outward of each back rank", () => {
    const s1 = seatSetup(1);
    expect(new Set([s1.pawnCcw, s1.pawnCw])).toEqual(new Set([d(31), d(2)]));
    const s2 = seatSetup(2);
    expect(new Set([s2.pawnCcw, s2.pawnCw])).toEqual(new Set([d(7), d(10)]));
    const s3 = seatSetup(3);
    expect(new Set([s3.pawnCcw, s3.pawnCw])).toEqual(new Set([d(15), d(18)]));
    const s4 = seatSetup(4);
    expect(new Set([s4.pawnCcw, s4.pawnCw])).toEqual(new Set([d(23), d(26)]));
  });

  it("K/Q per the §2.7 table: P1 K32D/Q1D · P2 K9D/Q8D · P3 K16D/Q17D · P4 K25D/Q24D", () => {
    expect(seatSetup(1).kingBack).toBe(d(32));
    expect(seatSetup(1).queenBack).toBe(d(1));
    expect(seatSetup(2).kingBack).toBe(d(9));
    expect(seatSetup(2).queenBack).toBe(d(8));
    expect(seatSetup(3).kingBack).toBe(d(16));
    expect(seatSetup(3).queenBack).toBe(d(17));
    expect(seatSetup(4).kingBack).toBe(d(25));
    expect(seatSetup(4).queenBack).toBe(d(24));
  });

  it("Like-Pieces-Face (§2.7): kings face kings, queens face queens across corners", () => {
    // NW corner: P1 K (32D) faces P4 K (25D) — both are their seats' kingBack.
    expect(seatSetup(1).kingBack).toBe(d(32));
    expect(seatSetup(4).kingBack).toBe(d(25));
    // NE: P1 Q (1D) faces P2 Q (8D).
    expect(seatSetup(1).queenBack).toBe(d(1));
    expect(seatSetup(2).queenBack).toBe(d(8));
    // SE: P2 K (9D) faces P3 K (16D).
    expect(seatSetup(2).kingBack).toBe(d(9));
    expect(seatSetup(3).kingBack).toBe(d(16));
    // SW: P3 Q (17D) faces P4 Q (24D).
    expect(seatSetup(3).queenBack).toBe(d(17));
    expect(seatSetup(4).queenBack).toBe(d(24));
  });
});

describe("promotion table (§5.7) — all 8 rows transcribed verbatim", () => {
  // [seat, pawn origin display rank, direction (+1 cw / −1 ccw), promotion display rank]
  //
  // RULEBOOK ERRATUM (recorded in docs/RULINGS.md): §5.7's two Player 4 rows
  // label their directions "clockwise"/"counterclockwise" swapped relative to
  // §2.1's global convention (rank numbers increase clockwise): 23→17 is
  // DECREASING, i.e. counterclockwise; 26→32 is increasing, i.e. clockwise.
  // The origin and promotion RANKS in those rows are correct and agree with
  // §2.8 (pawns advance away from their own Meridian); only the direction
  // words are transposed. P1–P3 rows all match the global convention. We
  // assert the §2.8-consistent directions and the table's ranks verbatim.
  const table: Array<[Seat, number, 1 | -1, number]> = [
    [1, 2, 1, 8],    // P1 rank 2, clockwise → rank 8 (P2's Q-side back rank)
    [1, 31, -1, 25], // P1 rank 31, counterclockwise → rank 25 (P4's K-side)
    [2, 7, -1, 1],   // P2 rank 7, counterclockwise → rank 1 (P1's Q-side)
    [2, 10, 1, 16],  // P2 rank 10, clockwise → rank 16 (P3's K-side)
    [3, 15, -1, 9],  // P3 rank 15, counterclockwise → rank 9 (P2's K-side)
    [3, 18, 1, 24],  // P3 rank 18, clockwise → rank 24 (P4's Q-side)
    [4, 23, -1, 17], // P4 rank 23 → rank 17 (P3's Q-side); see erratum note
    [4, 26, 1, 32],  // P4 rank 26 → rank 32 (P1's K-side); see erratum note
  ];

  it.each(table)(
    "seat %i pawn from rank %i advances %i and promotes at rank %i",
    (seat, origin, dir, promo) => {
      expect(pawnDirection(seat, d(origin))).toBe(dir);
      expect(promotionRank(seat, d(origin))).toBe(d(promo));
    },
  );

  it("every promotion rank is one of the target's back ranks", () => {
    for (const [seat, origin] of table) {
      const promo = promotionRank(seat, d(origin));
      const owner = quadrantOwner(promo);
      expect(backRanks(owner)).toContain(promo);
      expect(teamOf(owner)).not.toBe(teamOf(seat));
    }
  });
});

describe("display notation boundary (§2.2)", () => {
  // Founder's 2026-07-03 placeholder ruling: emission is FILE-FIRST ("D32"),
  // matching the rulebook §3.3 / TDD §3.4 move examples. (§2.2 prose is
  // rank-first; parseSquare accepts BOTH orders so fixtures and archives
  // survive a re-ruling.) formatSquare is the single emit point.
  it("formats the rulebook's example squares file-first", () => {
    expect(formatSquare(squareOf(d(32), 3))).toBe("D32");
    expect(formatSquare(squareOf(d(1), 0))).toBe("A1");
    expect(formatSquare(squareOf(d(17), 2))).toBe("C17");
  });

  it("parses what it formats, for all 128 squares", () => {
    for (let sq = 0; sq < 128; sq++) {
      expect(parseSquare(formatSquare(sq))).toBe(sq);
    }
  });

  it("round-trips the rank-first order too, for all 128 squares", () => {
    for (let sq = 0; sq < 128; sq++) {
      const fileFirst = formatSquare(sq); // e.g. "D32"
      const rankFirst = fileFirst.slice(1) + fileFirst[0]; // e.g. "32D"
      expect(parseSquare(rankFirst), rankFirst).toBe(sq);
    }
  });

  it("rejects malformed coordinates", () => {
    for (const bad of [
      "33D", "D33", // rank out of range, both orders
      "0A", "D0",   // rank 0, both orders
      "5E", "E5",   // no file E, both orders
      "", "12", "D", "1AA", "A1A",
    ]) {
      expect(() => parseSquare(bad), bad).toThrow();
    }
  });

  it("accepts lowercase files in either order", () => {
    expect(parseSquare("32d")).toBe(squareOf(d(32), 3));
    expect(parseSquare("d32")).toBe(squareOf(d(32), 3));
  });
});

describe("wrap consistency", () => {
  it("consecutive seats' meridians are exactly 8 ranks apart, all the way around", () => {
    for (const seat of SEATS) {
      const next = nextSeat(seat);
      expect(
        wrapRank(MERIDIAN_CW_START[next] - MERIDIAN_CW_START[seat]),
        `seat ${seat} → ${next}`,
      ).toBe(8);
    }
  });

  it("prevSeat inverts nextSeat", () => {
    for (const seat of SEATS) {
      expect(prevSeat(nextSeat(seat))).toBe(seat);
      expect(nextSeat(prevSeat(seat))).toBe(seat);
    }
  });
});

describe("meridian sides, seats 3 and 4 (exhaustive)", () => {
  it("South meridian: display 17–32 clockwise side, 1–16 counterclockwise", () => {
    for (let display = 17; display <= 32; display++) {
      expect(meridianSide(3, d(display)), `rank ${display}`).toBe("cw");
    }
    for (let display = 1; display <= 16; display++) {
      expect(meridianSide(3, d(display)), `rank ${display}`).toBe("ccw");
    }
  });

  it("West meridian: display 25–8 clockwise side, 9–24 counterclockwise", () => {
    for (const display of [25, 26, 27, 28, 29, 30, 31, 32, 1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(meridianSide(4, d(display)), `rank ${display}`).toBe("cw");
    }
    for (let display = 9; display <= 24; display++) {
      expect(meridianSide(4, d(display)), `rank ${display}`).toBe("ccw");
    }
  });
});

describe("spanCrossesOwnMeridian — the shared crossing primitive", () => {
  it("detects a crossing anywhere inside the span", () => {
    // North boundary between display 32|1: a 3-step cw slide from 30 (30→31→32→1) crosses.
    expect(spanCrossesOwnMeridian(1, d(30), 3, 1)).toBe(true);
    // 2 steps from 30 (30→31→32) does not.
    expect(spanCrossesOwnMeridian(1, d(30), 2, 1)).toBe(false);
    // Knight-style 2-rank jump across: from 32 cw 2 (32→1→2) crosses.
    expect(spanCrossesOwnMeridian(1, d(32), 2, 1)).toBe(true);
    // ccw from 2, 2 steps (2→1→32) crosses.
    expect(spanCrossesOwnMeridian(1, d(2), 2, -1)).toBe(true);
    // ccw from 3, 2 steps (3→2→1) does not.
    expect(spanCrossesOwnMeridian(1, d(3), 2, -1)).toBe(false);
    // Crossing SOMEONE ELSE'S meridian never counts: seat 1 sliding over the
    // East boundary.
    expect(spanCrossesOwnMeridian(1, d(7), 4, 1)).toBe(false);
  });

  it("a full 32-step orbit always crosses exactly its own boundary", () => {
    for (const seat of SEATS) {
      for (let start = 0; start < 32; start++) {
        expect(spanCrossesOwnMeridian(seat, start, 32, 1)).toBe(true);
        expect(spanCrossesOwnMeridian(seat, start, 32, -1)).toBe(true);
      }
    }
  });

  it("agrees with stepCrossesOwnMeridian on single steps", () => {
    for (const seat of SEATS) {
      for (let rank = 0; rank < 32; rank++) {
        for (const dir of [1, -1] as const) {
          expect(spanCrossesOwnMeridian(seat, rank, 1, dir)).toBe(
            stepCrossesOwnMeridian(seat, rank, dir),
          );
        }
      }
    }
  });
});
