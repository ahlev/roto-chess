/**
 * Golden games — full engine-generated games (opening double-moves through
 * checkmate) committed as .rpgn and replayed on every run. The showcase
 * game contains at least one halo, evaporation, castling, en passant, and
 * promotion. These lock the ENTIRE engine behavior: any rules change that
 * alters legality or notation breaks the replay loudly.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseGame, playGame, positionKey, evaluateStatus } from "../src/index.js";

const goldensDir = join(dirname(fileURLToPath(import.meta.url)), "goldens");

function load(name: string) {
  return readFileSync(join(goldensDir, name), "utf8");
}

describe("golden games", () => {
  it("the showcase game replays to checkmate with all five features", () => {
    const parsed = parseGame(load("golden-showcase.rpgn"));
    expect(parsed.turns.length).toBe(203);
    const fold = playGame(parsed.turns);
    expect(fold.finalStatus.kind).toBe("checkmate");
    if (fold.finalStatus.kind === "checkmate") {
      expect(fold.finalStatus.matedSeat).toBe(4);
    }
    // Feature census across the whole game:
    const features = {
      halo: false, evaporation: false, castle: false, ep: false, promo: false,
    };
    for (const step of fold.steps) {
      for (const m of step.turn.submoves) {
        if (m.earnsHalo) features.halo = true;
        if (m.evaporates) features.evaporation = true;
        if (m.castle) features.castle = true;
        if (m.enPassant) features.ep = true;
        if (m.promotion) features.promo = true;
      }
    }
    expect(features).toEqual({
      halo: true, evaporation: true, castle: true, ep: true, promo: true,
    });
    // Lock the exact final position.
    expect(positionKey(fold.finalState)).toMatchInlineSnapshot(`"1|4|10:Q1hp|40:K3|80:K4|81:Q3hp|86:K1|111:K2|af0000bfff0000efff00006fff0000dd||11"`);
  });

  it("golden game 2 replays to checkmate", () => {
    const parsed = parseGame(load("golden-2.rpgn"));
    expect(parsed.turns.length).toBe(237);
    expect(evaluateStatus(parsed.finalState).kind).toBe("checkmate");
  });
});
