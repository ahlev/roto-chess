/**
 * M2 fixtures — the Roto-specific state machines: halo timing (§6.2),
 * the evaporation ordering trap (§6.3), and the Avenger rule (§6.4, R4).
 */
import { describe, expect, it } from "vitest";
import { parseSquare } from "../src/geometry.js";
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

describe("the Avenger rule (§6.4, ruled 2026-07-18)", () => {
  /**
   * Grave-capture fixture. Seat 1's knight sits unmoved on its home square
   * 1C. 31B is the home square of a seat-1 pawn; with startPieceMoved[31B]
   * false and the pawn absent from the board, that pawn was captured there
   * before it ever moved — an unmoved teammate's grave. An enemy knight
   * (the intruder) stands on it.
   */
  function graveState(opts?: {
    knightMoved?: boolean;
    pawnHadMoved?: boolean;
    intruder?: boolean;
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
      startMoved: opts?.pawnHadMoved ? ["31B"] : [],
    });
  }

  it("an unmoved primary capturing the intruder on an unmoved teammate's grave crosses penalty-free", () => {
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

  it("no exemption when the grave's own piece had MOVED before it was lost (the 2HPMK case)", () => {
    // The pawn that started on 31B left its square earlier; whatever the
    // intruder took there, it was not an unmoved piece on its home square.
    const state = graveState({ pawnHadMoved: true });
    const move = mv(state, "1C", "31B");
    expect(move.captures).toBe(parseSquare("31B"));
    expect(move.avenger).toBeUndefined();
    expect(move.evaporates).toBe(true);
    const { state: after } = applyOk(state, [move]);
    expect(at(after, "31B")).toBeNull(); // intruder captured…
    expect(at(after, "1C")).toBeNull(); // …and the crosser evaporated
  });

  it("a quiet crossing is never an Avenger move — avenging requires the capture", () => {
    const state = graveState({ intruder: false }); // 31B is a grave, but empty
    const move = mv(state, "1C", "31B");
    expect(move.captures).toBeUndefined();
    expect(move.avenger).toBeUndefined();
    expect(move.evaporates).toBe(true);
  });

  it("capturing across the meridian on a square holding no fallen teammate evaporates", () => {
    // Rank 30 carries no game-start piece: no grave there, regardless of
    // what the team has lost elsewhere.
    const state = buildState({
      pieces: [
        { at: "1A", kind: "R", seat: 1 },
        { at: "30A", kind: "N", seat: 2, hasMoved: true, origin: "9C" },
      ],
      activeSeat: 1,
    });
    const move = mv(state, "1A", "30A", { rotDir: -1 });
    expect(move.captures).toBe(parseSquare("30A"));
    expect(move.avenger).toBeUndefined();
    expect(move.evaporates).toBe(true);
  });

  it("an unmoved PARTNER-seat piece's grave qualifies (own team's pieces, §6.4)", () => {
    // 17A is seat 3's rook home; that rook died unmoved; a seat-4 intruder
    // now stands on it. Seat 1 avenges its partner.
    const state = buildState({
      pieces: [
        { at: "1A", kind: "R", seat: 1 },
        { at: "17A", kind: "R", seat: 4, hasMoved: true, origin: "24A" },
      ],
      activeSeat: 1,
    });
    const move = mv(state, "1A", "17A", { rotDir: -1 });
    expect(move.captures).toBe(parseSquare("17A"));
    expect(move.avenger).toBe(true);
    expect(move.evaporates).toBeUndefined();
  });

  it("no exemption once the avenging piece has itself moved (§6.4 condition 1)", () => {
    const state = graveState({ knightMoved: true });
    const move = mv(state, "1C", "31B");
    expect(move.avenger).toBeUndefined();
    expect(move.evaporates).toBe(true);
  });
});
