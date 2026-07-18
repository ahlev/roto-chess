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
import {
  evaluateStatus,
  parseGame,
  playGame,
  positionKey,
  validateGameText,
} from "../src/index.js";

const goldensDir = join(dirname(fileURLToPath(import.meta.url)), "goldens");

function load(name: string) {
  return readFileSync(join(goldensDir, name), "utf8");
}

describe("golden games", () => {
  it("the showcase game replays to checkmate with all five features", () => {
    const parsed = parseGame(load("golden-showcase.rpgn"));
    expect(parsed.turns.length).toBe(189);
    const fold = playGame(parsed.turns);
    expect(fold.finalStatus.kind).toBe("checkmate");
    if (fold.finalStatus.kind === "checkmate") {
      expect(fold.finalStatus.matedSeat).toBe(2);
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
    expect(positionKey(fold.finalState)).toMatchInlineSnapshot(`"1|2|3:K1|4:K2|33:Q3hp|43:P3|44:K3|90:K4|116:R1h|ff00004fbf0000efbf00006fef0000ef|"`);
  });

  it("golden game 2 replays to checkmate", () => {
    const parsed = parseGame(load("golden-2.rpgn"));
    expect(parsed.turns.length).toBe(145);
    expect(evaluateStatus(parsed.finalState).kind).toBe("checkmate");
  });

  it("the legacy-format fixture (pre-spec emit) still replays identically", () => {
    // legacy-golden-2.rpgn is the same game as golden-2.rpgn as emitted by
    // the pre-spec serializer: bare unlabeled tokens, unspaced &, compass
    // headers, Result "NS", ResultReason. It must load forever.
    const legacy = parseGame(load("legacy-golden-2.rpgn"));
    const current = parseGame(load("golden-2.rpgn"));
    expect(legacy.turns.length).toBe(current.turns.length);
    expect(positionKey(legacy.finalState)).toBe(
      positionKey(current.finalState),
    );
    expect(legacy.headers.result).toBe("13"); // "NS" normalized
    expect(legacy.headers.termination).toBe("checkmate"); // ResultReason alias
  });

  it("validateGameText flags a Result header the replay contradicts", () => {
    const text = load("golden-2.rpgn");
    expect(validateGameText(text).issues).toEqual([]);
    const lied = text.replace(/\[Result "[^"]+"\]/u, '[Result "24"]');
    expect(lied).not.toBe(text);
    const issues = validateGameText(lied).issues;
    expect(issues.length).toBe(1);
    expect(issues[0]?.kind).toBe("result-mismatch");
    // parseGame stays permissive about results — only the archive harness
    // treats a result mismatch as a failure.
    expect(() => parseGame(lied)).not.toThrow();
  });
});
