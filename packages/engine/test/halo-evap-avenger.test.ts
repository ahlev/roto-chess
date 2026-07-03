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
    const state = buildState({
      pieces: [
        { at: "2B", kind: "N", seat: 1 },
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

describe("the Avenger rule (§6.4, rulings R4a/R4b)", () => {
  /** Seat 1 knight on its original square; a qualifying team loss exists. */
  function avengerState(opts?: {
    knightMoved?: boolean;
    loss?: boolean;
  }) {
    return buildState({
      pieces: [
        {
          at: "1C",
          kind: "N",
          seat: 1,
          hasMoved: opts?.knightMoved ?? false,
        },
      ],
      activeSeat: 1,
      avengeableLoss: [opts?.loss ?? true, false],
    });
  }

  it("an unmoved primary with a qualifying team loss crosses penalty-free", () => {
    const state = avengerState();
    const move = mv(state, "1C", "31B"); // jumps across the north meridian
    expect(move.avenger).toBe(true);
    expect(move.evaporates).toBeUndefined();
    const { state: after, events } = applyOk(state, [move]);
    expect(at(after, "31B")?.kind).toBe("N");
    expect(events.avengerMoves).toEqual([parseSquare("31B")]);
  });

  it("R4b: the avenging move need not capture", () => {
    const move = mv(avengerState(), "1C", "31B");
    expect(move.captures).toBeUndefined();
    expect(move.avenger).toBe(true);
  });

  it("no exemption once the avenging piece has moved (§6.4 condition 1)", () => {
    const state = avengerState({ knightMoved: true });
    const move = mv(state, "1C", "31B");
    expect(move.avenger).toBeUndefined();
    expect(move.evaporates).toBe(true);
  });

  it("no exemption without a qualifying loss (§6.4 condition 2)", () => {
    const state = avengerState({ loss: false });
    const move = mv(state, "1C", "31B");
    expect(move.avenger).toBeUndefined();
    expect(move.evaporates).toBe(true);
  });

  it("capturing an UNMOVED piece on its start square records the loss for its team", () => {
    const state = buildState({
      pieces: [
        { at: "5B", kind: "R", seat: 1, halo: true },
        { at: "8B", kind: "B", seat: 2 }, // unmoved on its §2.6 start square
      ],
      activeSeat: 1,
    });
    const { state: after } = applyOk(state, [mv(state, "5B", "8B", { rotDir: 1 })]);
    expect(after.avengeableLoss).toEqual([false, true]); // team 2 may avenge
  });

  it("capturing a MOVED piece records nothing (§6.4 condition 2)", () => {
    const state = buildState({
      pieces: [
        { at: "5B", kind: "R", seat: 1, halo: true },
        { at: "6B", kind: "B", seat: 2, hasMoved: true, origin: "8B" },
      ],
      activeSeat: 1,
    });
    const { state: after } = applyOk(state, [mv(state, "5B", "6B", { rotDir: 1 })]);
    expect(after.avengeableLoss).toEqual([false, false]);
  });

  it("evaporation is not a capture: it never records an avengeable loss", () => {
    const state = buildState({
      pieces: [{ at: "2B", kind: "N", seat: 1 }],
      activeSeat: 1,
    });
    const { state: after } = applyOk(state, [mv(state, "2B", "32C")]);
    expect(after.avengeableLoss).toEqual([false, false]);
  });
});
