/**
 * The rules-page §5 demos promise specific engine behavior — that the unhaloed
 * crosser evaporates, the haloed one doesn't, and the unmoved Avenger crosses
 * penalty-free. These assert the ENGINE flags for the exact positions the page
 * builds, so a demo can never silently start teaching the wrong thing.
 */
import { describe, it, expect } from "vitest";
import { legalMovesFrom, parseSquare } from "@rotochess/engine";
import { demoState } from "../src/lib/game/demo-positions";

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

  it("§5.4 — an unmoved knight whose team was wounded crosses penalty-free", () => {
    const s = demoState([{ at: "1C", kind: "N", seat: 1 }], 1, {
      avengeableLoss: [true, false],
    });
    const moves = legalMovesFrom(s, parseSquare("1C"));
    const avengerMoves = moves.filter((m) => m.avenger);
    expect(avengerMoves.length).toBeGreaterThan(0);
    // Avenger and evaporation are mutually exclusive — the exemption saves it.
    expect(avengerMoves.every((m) => !m.evaporates)).toBe(true);
  });
});
