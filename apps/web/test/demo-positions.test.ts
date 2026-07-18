/**
 * The rules-page §5 demos promise specific engine behavior — that the unhaloed
 * crosser evaporates, the haloed one doesn't, and the unmoved Avenger crosses
 * penalty-free. These assert the ENGINE flags for the exact positions the page
 * builds, so a demo can never silently start teaching the wrong thing.
 */
import { describe, it, expect } from "vitest";
import { legalMovesFrom, parseSquare } from "@rotochess/engine";
import { demoState } from "../src/lib/game/demo-positions";
import { bestPreview } from "../src/lib/game/demo-preview";

describe("rules §5 demo scenarios — engine flags", () => {
  it("§5.3 — the unhaloed knight has an evaporating crossing, never an Avenger one", () => {
    const s = demoState([
      { at: "2B", kind: "N", seat: 1, hasMoved: true, origin: "1C" },
    ]);
    const moves = legalMovesFrom(s, parseSquare("2B"));
    expect(moves.some((m) => m.evaporates)).toBe(true);
    expect(moves.some((m) => m.avenger)).toBe(false);
  });

  it("§5.2 — the haloed knight never evaporates or avenges (home is open)", () => {
    const s = demoState([
      { at: "2B", kind: "N", seat: 1, halo: true, hasMoved: true, origin: "1C" },
    ]);
    const moves = legalMovesFrom(s, parseSquare("2B"));
    expect(moves.some((m) => m.evaporates)).toBe(false);
    expect(moves.some((m) => m.avenger)).toBe(false);
  });

  it("bestPreview prefers the short clean route over an evaporating loop", () => {
    // An UNHALOED North rook at 5B can reach 7B two ways: the short +2-rank
    // slide (clean) or the long way around the ring (crosses North's meridian
    // at the 32↔1 seam → evaporates). The preview must default to the short,
    // non-evaporating move — not the dramatic loop.
    const s = demoState([{ at: "5B", kind: "R", seat: 1, hasMoved: true }]);
    const toB7 = legalMovesFrom(s, parseSquare("5B")).filter(
      (m) => m.to === parseSquare("7B"),
    );
    expect(toB7.length).toBeGreaterThan(1); // both routes exist
    expect(toB7.some((m) => m.evaporates)).toBe(true); // the loop evaporates
    const pick = bestPreview(toB7);
    expect(pick).not.toBeNull();
    expect(pick?.evaporates ?? false).toBe(false); // preview the clean one
  });

  it("§5.4 — an unmoved knight avenges by capturing the intruder on a fallen teammate's square", () => {
    // 31B is the home square of North's pawn, captured there before it ever
    // moved (absent + startPieceMoved false); an intruder stands on it.
    const s = demoState([
      { at: "1C", kind: "N", seat: 1 },
      { at: "31B", kind: "N", seat: 2, hasMoved: true, origin: "9C" },
    ]);
    const moves = legalMovesFrom(s, parseSquare("1C"));
    const avengerMoves = moves.filter((m) => m.avenger);
    expect(avengerMoves.length).toBeGreaterThan(0);
    expect(avengerMoves.every((m) => m.to === parseSquare("31B"))).toBe(true);
    // Avenger and evaporation are mutually exclusive — the exemption saves it.
    expect(avengerMoves.every((m) => !m.evaporates)).toBe(true);
  });
});
