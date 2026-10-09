/**
 * M2 fixtures — the Roto-specific state machines: halo timing (§6.2),
 * the evaporation ordering trap (§6.3), and the Avenger rule (§6.4, R4).
 */
import { describe, expect, it } from "vitest";
import { parseSquare, seatSetup, squareOf, type Square } from "../src/geometry.js";
import { legalMovesFrom, legalSecondSubmoves, positionKey } from "../src/legal.js";
import { deserializeState, serializeState } from "../src/state.js";
import { buildState, mv, applyOk, at } from "./helpers.js";

describe("the evaporation ordering trap (§6.3)", () => {
  it("the move completes — INCLUDING the capture — then the piece evaporates; the just-earned halo does NOT save it", () => {
    // Non-haloed seat-1 knight at 2B captures across its own meridian at 32C.
    // (Moved off its 1C home so §6.4 can't exempt it — 32C is a grave.)
    const state = buildState({
      pieces: [
        { at: "2B", kind: "N", seat: 1, hasMoved: true, origin: "1C" },
        { at: "32C", kind: "P", seat: 2, hasMoved: true, origin: "10C" },
      ],
      activeSeat: 1,
    });
    const move = mv(state, "2B", "32C");
    expect(move.captures).toBe(parseSquare("32C"));
    expect(move.earnsHalo).toBe(true); // the capture earns it...
    expect(move.evaporates).toBe(true); // ...and evaporation still executes

    const { state: after, events } = applyOk(state, [move]);
    expect(at(after, "32C")).toBeNull(); // victim gone AND knight gone
    expect(at(after, "2B")).toBeNull();
    expect(events.captures).toBe(1);
    expect(events.evaporations).toEqual([parseSquare("32C")]);
  });

  it("a haloed piece crosses its own meridian freely (§6.2)", () => {
    const state = buildState({
      pieces: [{ at: "2B", kind: "N", seat: 1, halo: true }],
      activeSeat: 1,
    });
    const move = mv(state, "2B", "32C");
    expect(move.evaporates).toBeUndefined();
    const { state: after } = applyOk(state, [move]);
    expect(at(after, "32C")?.kind).toBe("N");
    expect(at(after, "32C")?.halo).toBe(true);
  });

  it("evaporation can expose one's own king — such a move is illegal (§7.1)", () => {
    // Seat 1's unhaloed rook at 31D shields K@32D from a seat-2 rook at 28D.
    // Sliding 31D→1D crosses the meridian (the rook would evaporate) AND
    // abandons the shield: after evaporation nothing blocks 28D's attack on
    // 32D, so the self-check filter must reject the move entirely.
    const state = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "31D", kind: "R", seat: 1 },
        { at: "28D", kind: "R", seat: 2, hasMoved: true, origin: "9A" },
      ],
      activeSeat: 1,
    });
    expect(() => mv(state, "31D", "1D", { rotDir: 1 })).toThrow(/No legal move/);
  });
});

describe("the Avenger rule (§6.4, R4 + window ruling 2026-10-08)", () => {
  /**
   * Grave-capture fixture. Seat 1's knight sits unmoved on its home square
   * 1C. 31B is the home square of a seat-1 pawn that was captured there
   * before it ever moved — an unmoved teammate's grave — and an enemy knight
   * (the intruder) stands on it. By default it is seat 1's first turn since
   * that loss, so the Avenger window is open.
   */
  function graveState(opts?: {
    knightMoved?: boolean;
    intruder?: boolean;
    windowOpen?: boolean;
  }) {
    return buildState({
      pieces: [
        { at: "1C", kind: "N", seat: 1, hasMoved: opts?.knightMoved ?? false },
        ...((opts?.intruder ?? true)
          ? [
              {
                at: "31B",
                kind: "N" as const,
                seat: 2 as const,
                hasMoved: true,
                origin: "9C",
              },
            ]
          : []),
      ],
      activeSeat: 1,
      avengeWindows:
        (opts?.windowOpen ?? true) ? [{ square: "31B", victimSeat: 1 }] : [],
    });
  }

  it("an unmoved primary capturing the intruder on its grave, on the victim's next turn, crosses penalty-free", () => {
    const state = graveState();
    const move = mv(state, "1C", "31B"); // jumps across the north meridian
    expect(move.captures).toBe(parseSquare("31B"));
    expect(move.avenger).toBe(true);
    expect(move.evaporates).toBeUndefined();
    expect(move.earnsHalo).toBe(true); // the capture also earns the halo (§6.2)
    const { state: after, events } = applyOk(state, [move]);
    expect(at(after, "31B")?.kind).toBe("N");
    expect(at(after, "31B")?.seat).toBe(1); // avenger survives on the grave
    expect(events.avengerMoves).toEqual([parseSquare("31B")]);
  });

  it("no exemption once the window has closed — avenging in a later round evaporates", () => {
    const state = graveState({ windowOpen: false });
    const move = mv(state, "1C", "31B");
    expect(move.captures).toBe(parseSquare("31B"));
    expect(move.avenger).toBeUndefined();
    expect(move.evaporates).toBe(true);
    const { state: after } = applyOk(state, [move]);
    expect(at(after, "31B")).toBeNull(); // intruder captured…
    expect(at(after, "1C")).toBeNull(); // …and the crosser evaporated
  });

  it("a quiet crossing is never an Avenger move — avenging requires the capture", () => {
    const state = graveState({ intruder: false }); // window open, grave empty
    const move = mv(state, "1C", "31B");
    expect(move.captures).toBeUndefined();
    expect(move.avenger).toBeUndefined();
    expect(move.evaporates).toBe(true);
  });

  it("capturing across the meridian on a square with no open window evaporates", () => {
    const state = buildState({
      pieces: [
        { at: "1A", kind: "R", seat: 1 },
        { at: "30A", kind: "N", seat: 2, hasMoved: true, origin: "9C" },
      ],
      activeSeat: 1,
      avengeWindows: [{ square: "31B", victimSeat: 1 }], // a different grave
    });
    const move = mv(state, "1A", "30A", { rotDir: -1 });
    expect(move.captures).toBe(parseSquare("30A"));
    expect(move.avenger).toBeUndefined();
    expect(move.evaporates).toBe(true);
  });

  it("a PARTNER cannot avenge — the window belongs to the victim's own turn", () => {
    // 17A is seat 3's rook home; that rook died unmoved; a seat-4 intruder
    // stands on it. Even with seat 3's window open, seat 1 is not the victim.
    const state = buildState({
      pieces: [
        { at: "1A", kind: "R", seat: 1 },
        { at: "17A", kind: "R", seat: 4, hasMoved: true, origin: "24A" },
      ],
      activeSeat: 1,
      avengeWindows: [{ square: "17A", victimSeat: 3 }],
    });
    const move = mv(state, "1A", "17A", { rotDir: -1 });
    expect(move.captures).toBe(parseSquare("17A"));
    expect(move.avenger).toBeUndefined();
    expect(move.evaporates).toBe(true);
  });

  it("no exemption once the avenging piece has itself moved (§6.4 condition 1)", () => {
    const state = graveState({ knightMoved: true });
    const move = mv(state, "1C", "31B");
    expect(move.avenger).toBeUndefined();
    expect(move.evaporates).toBe(true);
  });

  describe("window lifecycle", () => {
    /** Seat 4's haloed knight on 29C can take seat 1's unmoved pawn on 31D. */
    function seat4ToMove() {
      return buildState({
        pieces: [
          { at: "1C", kind: "N", seat: 1 },
          { at: "31D", kind: "P", seat: 1 },
          { at: "29C", kind: "N", seat: 4, halo: true, origin: "25C" },
        ],
        activeSeat: 4,
      });
    }

    it("capturing an unmoved piece on its home square opens a window for its owner", () => {
      const start = seat4ToMove();
      const { state } = applyOk(start, [mv(start, "29C", "31D")]);
      expect(state.activeSeat).toBe(1);
      expect(state.avengeWindows).toEqual([
        { square: parseSquare("31D"), victimSeat: 1 },
      ]);
      // …and the victim avenges on that very turn.
      const avenge = mv(state, "1C", "31D");
      expect(avenge.avenger).toBe(true);
      expect(avenge.evaporates).toBeUndefined();
    });

    it("the window closes at the end of the victim's turn, used or not", () => {
      const start = seat4ToMove();
      const { state: s1 } = applyOk(start, [mv(start, "29C", "31D")]);
      const kingMove = legalMovesFrom(s1, kingHome(1))[0];
      expect(kingMove).toBeDefined();
      const { state: s2 } = applyOk(s1, [kingMove!]);
      expect(s2.avengeWindows).toEqual([]);
    });

    it("capturing a piece that had moved opens no window (the 2HPMK case)", () => {
      const state = buildState({
        pieces: [
          { at: "31D", kind: "P", seat: 1, hasMoved: true, origin: "31C" },
          { at: "29C", kind: "N", seat: 4, halo: true, origin: "25C" },
        ],
        activeSeat: 4,
      });
      const { state: after } = applyOk(state, [mv(state, "29C", "31D")]);
      expect(after.avengeWindows).toEqual([]);
    });

    it("a loss to seat 2 stays avengeable through seats 3 and 4, then on seat 1's turn", () => {
      // Seat 2's haloed rook takes seat 1's unmoved pawn on 2A.
      let state = buildState({
        pieces: [
          { at: "32A", kind: "R", seat: 1 },
          { at: "2A", kind: "P", seat: 1 },
          { at: "5A", kind: "R", seat: 2, halo: true, origin: "9A" },
        ],
        activeSeat: 2,
      });
      state = applyOk(state, [mv(state, "5A", "2A")]).state;
      for (const seat of [3, 4] as const) {
        expect(state.activeSeat).toBe(seat);
        const k = legalMovesFrom(state, kingHome(seat))[0];
        expect(k).toBeDefined();
        state = applyOk(state, [k!]).state;
        expect(state.avengeWindows).toEqual([
          { square: parseSquare("2A"), victimSeat: 1 },
        ]);
      }
      expect(state.activeSeat).toBe(1);
      const avenge = mv(state, "32A", "2A", { rotDir: 1 });
      expect(avenge.avenger).toBe(true);
      expect(avenge.evaporates).toBeUndefined();
    });

    it("an opening double-move turn sees the window on its second submove", () => {
      const state = buildState({
        pieces: [
          { at: "1C", kind: "N", seat: 1 },
          { at: "32A", kind: "R", seat: 1 },
          { at: "31D", kind: "N", seat: 2, hasMoved: true, origin: "9C" },
        ],
        activeSeat: 1,
        ply: 4,
        avengeWindows: [{ square: "31D", victimSeat: 1 }],
      });
      const first = legalMovesFrom(state, parseSquare("32A")).find(
        (m) => m.to === parseSquare("31A"),
      );
      expect(first).toBeDefined();
      const second = legalSecondSubmoves(state, first!).find(
        (m) => m.from === parseSquare("1C") && m.to === parseSquare("31D"),
      );
      expect(second?.avenger).toBe(true);
      const { state: after } = applyOk(state, [first!, second!]);
      expect(after.avengeWindows).toEqual([]);
    });
  });

  it("an older snapshot without avengeWindows loads with none open", () => {
    const raw = JSON.parse(serializeState(graveState())) as Record<string, unknown>;
    delete raw.avengeWindows;
    expect(deserializeState(JSON.stringify(raw)).avengeWindows).toEqual([]);
  });

  it("open windows are part of the repetition position key", () => {
    expect(positionKey(graveState())).not.toBe(
      positionKey(graveState({ windowOpen: false })),
    );
  });
});

/** A seat's king home square (where buildState auto-places it). */
function kingHome(seat: 1 | 2 | 3 | 4): Square {
  return squareOf(seatSetup(seat).kingBack, 3);
}
