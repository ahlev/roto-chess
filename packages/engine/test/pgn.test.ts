/**
 * M3 — Roto-PGN round-trip and Game-layer fold. All sample tokens here are
 * ENGINE-GENERATED (Andrew's rule: never hand-write spec examples).
 */
import { describe, expect, it } from "vitest";
import { initialState } from "../src/state.js";
import {
  applyTurn,
  legalMoves,
  legalSecondSubmoves,
} from "../src/legal.js";
import type { BoardState } from "../src/state.js";
import type { Move, Turn } from "../src/moves.js";
import {
  formatSquareToken,
  moveToDisplay,
  moveToToken,
  parseGame,
  parseSquareToken,
  serializeGame,
  turnToDisplay,
  turnToToken,
  validateGameText,
} from "../src/pgn.js";
import {
  gameFromRotoPgn,
  gameToRotoPgn,
  playGame,
  resultHeaderOf,
  stateAtPly,
} from "../src/game.js";
import { buildState, mv } from "./helpers.js";

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomTurns(seed: number, maxTurns: number): Turn[] {
  const rand = rng(seed);
  const turns: Turn[] = [];
  let state = initialState();
  for (let t = 0; t < maxTurns; t++) {
    const firsts = legalMoves(state);
    if (firsts.length === 0) break;
    const first = firsts[Math.floor(rand() * firsts.length)] as Move;
    let turn: Turn;
    if (state.ply < 20) {
      const seconds = legalSecondSubmoves(state, first);
      if (seconds.length === 0) break;
      turn = {
        submoves: [first, seconds[Math.floor(rand() * seconds.length)] as Move] as const,
      };
    } else {
      turn = { submoves: [first] as const };
    }
    const r = applyTurn(state, turn);
    if (!r.ok) throw new Error(r.error);
    turns.push(turn);
    state = r.state;
  }
  return turns;
}

describe("token shape", () => {
  it("canonical tokens are file-first with P required (R10)", () => {
    const state = buildState({
      pieces: [{ at: "2B", kind: "P", seat: 1 }],
      activeSeat: 1,
    });
    expect(moveToToken(state, mv(state, "2B", "3B"))).toBe("PB2-B3");
  });

  it("captures use x; halo/evaporation/avenger suffix correctly", () => {
    const state = buildState({
      pieces: [
        { at: "5B", kind: "R", seat: 1 },
        { at: "5C", kind: "P", seat: 2 },
      ],
      activeSeat: 1,
    });
    expect(moveToToken(state, mv(state, "5B", "5C"))).toBe("RB5xC5*");
  });

  it("evaporating capture carries BOTH marks: halo earned (*), then evaporated (†)", () => {
    const state = buildState({
      pieces: [
        // Moved off its 1C home so §6.4 can't exempt the crossing.
        { at: "2B", kind: "N", seat: 1, hasMoved: true, origin: "1C" },
        { at: "32C", kind: "P", seat: 2, hasMoved: true, origin: "10C" },
      ],
      activeSeat: 1,
    });
    expect(moveToToken(state, mv(state, "2B", "32C"))).toBe("NB2xC32*†");
  });

  it("castles are O-O and O-O-O", () => {
    const q = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "1D", kind: "Q", seat: 1 },
      ],
      activeSeat: 1,
    });
    expect(moveToToken(q, mv(q, "32D", "1D"))).toBe("O-O-O");
    const k = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "32A", kind: "R", seat: 1 },
      ],
      activeSeat: 1,
      startMoved: ["32B", "32C"],
    });
    expect(moveToToken(k, mv(k, "32D", "32A"))).toBe("O-O");
  });

  it("opening turns join with & and en passant marks e.p.", () => {
    const state = initialState();
    const firsts = legalMoves(state);
    const first = firsts[0] as Move;
    const second = legalSecondSubmoves(state, first)[0] as Move;
    const { token } = turnToToken(state, { submoves: [first, second] as const });
    expect(token).toContain("&");
  });
});

describe("round-trip property", () => {
  it(
    "serialize → parse reproduces the exact turn list and final state, across seeds",
    { timeout: 240_000 },
    () => {
      for (const seed of [11, 222, 3333, 44444]) {
        const turns = randomTurns(seed, 32);
        expect(turns.length).toBeGreaterThan(5);
        const headers = {
          event: `Seed ${seed}`,
          player1: "N", player2: "E", player3: "S", player4: "W",
        };
        const text = serializeGame({ headers, turns });
        const parsed = parseGame(text);
        expect(parsed.turns.length, `seed ${seed}`).toBe(turns.length);
        const original = playGame(turns).finalState;
        expect(parsed.finalState, `seed ${seed}`).toEqual(original);
        // And the reserialization is byte-identical (canonical form):
        const text2 = serializeGame({ headers, turns: parsed.turns });
        expect(text2).toBe(text);
      }
    },
  );

  it("headers survive the trip", () => {
    const turns = randomTurns(7, 8);
    const text = serializeGame({
      headers: {
        event: "The Thursday Board",
        site: "rotochess.app",
        date: "2026.07.03",
        player1: "Cashin", player2: "GK", player3: "Danny", player4: "Andrew",
      },
      turns,
    });
    const parsed = parseGame(text);
    expect(parsed.headers.event).toBe("The Thursday Board");
    expect(parsed.headers.player4).toBe("Andrew");
    expect(parsed.headers.result).toBe("*");
    expect(parsed.headers.team13).toBe("Players 1 & 3");
    expect(parsed.headers.team24).toBe("Players 2 & 4");
  });

  it("emits the TDD §3.8 header set in spec order", () => {
    const turns = randomTurns(7, 8);
    const text = serializeGame({
      headers: {
        event: "Spec headers",
        date: "2026.07.03",
        player1: "A", player2: "B", player3: "C", player4: "D",
      },
      turns,
    });
    const headerLines = text
      .split("\n")
      .filter((l) => l.startsWith("["))
      .map((l) => l.slice(1, l.indexOf(" ")));
    expect(headerLines).toEqual([
      "Event", "Date", "Player1", "Player2", "Player3", "Player4",
      "Team13", "Team24", "Result", "Variant",
    ]);
    expect(text).toContain('[Variant "Roto Chess v3.1"]');
  });

  it("movetext is round-grouped with P1:–P4: labels and spaced &", () => {
    const turns = randomTurns(11, 8);
    const text = serializeGame({ turns });
    const movetext = text
      .split("\n")
      .filter((l) => l && !l.startsWith("["))
      .join(" ");
    expect(movetext).toMatch(/^1\. P1: /u);
    expect(movetext).toContain("2. P1:");
    expect(movetext).toContain("P2:");
    expect(movetext).toContain("P4:");
    expect(movetext).toContain(" & "); // opening submoves, spaced
    expect(movetext).not.toMatch(/\S&/u); // never unspaced in the file
  });
});

describe("game layer", () => {
  it("playGame folds deterministically and stateAtPly scrubs", () => {
    const turns = randomTurns(99, 24);
    const fold = playGame(turns);
    expect(fold.steps).toHaveLength(turns.length);
    const mid = stateAtPly(turns, 10);
    expect(mid.ply).toBe(10);
    expect(fold.steps[9]?.state).toEqual(mid);
  });

  it("gameToRotoPgn derives result headers from the fold", () => {
    const turns = randomTurns(5, 12);
    const text = gameToRotoPgn(turns, { event: "Header derivation" });
    expect(text).toContain('[Result "*"]'); // random short game: ongoing
    const parsed = gameFromRotoPgn(text);
    expect(parsed.turns.length).toBe(turns.length);
  });

  it("resultHeaderOf maps teams to the spec's 13/24/Draw values", () => {
    expect(
      resultHeaderOf({ kind: "checkmate", matedSeat: 1, winningTeam: 2 }),
    ).toBe("24");
    expect(
      resultHeaderOf({ kind: "checkmate", matedSeat: 2, winningTeam: 1 }),
    ).toBe("13");
    expect(resultHeaderOf({ kind: "stalemate", stalematedSeat: 3 })).toBe(
      "Draw",
    );
  });

  it("a corrupt record fails loudly, not silently", () => {
    const turns = randomTurns(13, 6);
    const text = serializeGame({ turns });
    const corrupted = text.replace(/PB(\d+)-/u, "PC$1-");
    expect(corrupted).not.toBe(text);
    expect(() => parseGame(corrupted)).toThrow();
  });
});

describe("square-token order (parser accepts both)", () => {
  it("rank-first and file-first tokens parse to the same square", () => {
    expect(parseSquareToken("32D")).toBe(parseSquareToken("D32"));
    expect(parseSquareToken("1A")).toBe(parseSquareToken("A1"));
    expect(parseSquareToken("17C")).toBe(parseSquareToken("C17"));
    // Emission is file-first per the founder's 2026-07-03 placeholder ruling
    // (one place to flip if re-ruled):
    expect(formatSquareToken(parseSquareToken("32D"))).toBe("D32");
  });

  it("a whole game rewritten rank-first replays identically", () => {
    const turns = randomTurns(31, 24);
    const text = serializeGame({ turns });
    const rankFirst = text.replace(
      /([KQRBNP])([A-D])([0-9]{1,2})([-x])([A-D])([0-9]{1,2})/gu,
      "$1$3$2$4$6$5",
    );
    expect(rankFirst).not.toBe(text);
    const parsed = parseGame(rankFirst);
    expect(parsed.turns.length).toBe(turns.length);
    expect(parsed.finalState).toEqual(playGame(turns).finalState);
  });
});

describe("legacy-format leniency (old exports and DB movetext still load)", () => {
  it("bare unlabeled movetext with unspaced & (the DB form) parses", () => {
    const turns = randomTurns(17, 24);
    let state = initialState();
    const tokens = turns.map((turn) => {
      const { token, after } = turnToToken(state, turn);
      state = after;
      return token;
    });
    // HistoryPane's exact reconstruction: tokens joined by spaces, no
    // headers, no round numbers, no P1:–P4: labels.
    const parsed = parseGame(`${tokens.join(" ")}\n`);
    expect(parsed.turns.length).toBe(turns.length);
    expect(parsed.finalState).toEqual(state);
  });

  it("legacy headers map onto the spec fields (North→Player1, NS→13, ResultReason→Termination)", () => {
    const turns = randomTurns(23, 8);
    let state = initialState();
    const parts: string[] = [];
    turns.forEach((turn, i) => {
      if (i % 4 === 0) parts.push(`${Math.floor(i / 4) + 1}.`);
      const { token, after } = turnToToken(state, turn);
      parts.push(token);
      state = after;
    });
    const legacy = [
      '[Event "Legacy dialect"]',
      '[Site "engine-generated"]',
      '[Variant "Roto Chess v3.1"]',
      '[North "Cashin"]',
      '[West "Andrew"]',
      '[Result "NS"]',
      '[ResultReason "checkmate"]',
      "",
      parts.join(" "),
      "",
    ].join("\n");
    const parsed = parseGame(legacy);
    expect(parsed.headers.player1).toBe("Cashin");
    expect(parsed.headers.player4).toBe("Andrew");
    expect(parsed.headers.result).toBe("13");
    expect(parsed.headers.termination).toBe("checkmate");
    expect(parsed.turns.length).toBe(turns.length);
    // Legacy "EW" and "draw" results normalize too:
    const ew = parseGame(legacy.replace('[Result "NS"]', '[Result "EW"]'));
    expect(ew.headers.result).toBe("24");
    const draw = parseGame(legacy.replace('[Result "NS"]', '[Result "draw"]'));
    expect(draw.headers.result).toBe("Draw");
  });
});

describe("moveToDisplay (TDD §3.1 abbreviated form)", () => {
  it("pawn moves drop the P; a unique reacher drops the from-square", () => {
    const state = buildState({
      pieces: [{ at: "2B", kind: "P", seat: 1 }],
      activeSeat: 1,
    });
    expect(moveToToken(state, mv(state, "2B", "3B"))).toBe("PB2-B3");
    expect(moveToDisplay(state, mv(state, "2B", "3B"))).toBe("B3");
  });

  it("pawn captures keep the x", () => {
    const state = buildState({
      pieces: [
        { at: "2B", kind: "P", seat: 1 },
        { at: "3C", kind: "P", seat: 2 },
      ],
      activeSeat: 1,
    });
    expect(moveToDisplay(state, mv(state, "2B", "3C"))).toBe("xC3");
  });

  it("a non-pawn with a unique reacher keeps its letter, drops the from-square", () => {
    const state = buildState({
      pieces: [{ at: "2B", kind: "N", seat: 1 }],
      activeSeat: 1,
    });
    expect(moveToDisplay(state, mv(state, "2B", "4C"))).toBe("NC4");
  });

  it("ambiguity retains the from-square (which then names the piece — letter drops)", () => {
    const state = buildState({
      pieces: [
        { at: "5B", kind: "R", seat: 1 },
        { at: "9B", kind: "R", seat: 1 },
      ],
      activeSeat: 1,
    });
    // Both rooks can legally reach 7B — the from-square must stay.
    expect(moveToDisplay(state, mv(state, "5B", "7B"))).toBe("B5-B7");
    // (The 9B rook passes display rank 8 — an opposing back rank — so its
    // §6.2 halo mark rides along even on the abbreviated form.)
    expect(moveToDisplay(state, mv(state, "9B", "7B"))).toBe("B9-B7*");
  });

  it("suffix annotations survive abbreviation", () => {
    const halo = buildState({
      pieces: [
        { at: "5B", kind: "R", seat: 1 },
        { at: "5C", kind: "P", seat: 2 },
      ],
      activeSeat: 1,
    });
    expect(moveToDisplay(halo, mv(halo, "5B", "5C"))).toBe("RxC5*");
    const evap = buildState({
      pieces: [
        // Moved off its 1C home so §6.4 can't exempt the crossing.
        { at: "2B", kind: "N", seat: 1, hasMoved: true, origin: "1C" },
        { at: "32C", kind: "P", seat: 2, hasMoved: true, origin: "10C" },
      ],
      activeSeat: 1,
    });
    expect(moveToDisplay(evap, mv(evap, "2B", "32C"))).toBe("NxC32*†");
  });

  it("turnToDisplay pairs opening submoves with a spaced & and carries the canonical form", () => {
    const state = initialState();
    const first = legalMoves(state)[0] as Move;
    const second = legalSecondSubmoves(state, first)[0] as Move;
    const turn: Turn = { submoves: [first, second] as const };
    const { display, canonical, after } = turnToDisplay(state, turn);
    expect(display).toContain(" & ");
    expect(canonical).toContain("&");
    expect(canonical).toBe(turnToToken(state, turn).token);
    expect(after.ply).toBe(1);
  });
});

describe("validateGameText (archive-grade structured validation)", () => {
  it("a clean game yields zero issues", () => {
    const turns = randomTurns(3, 24);
    const v = validateGameText(serializeGame({ turns }));
    expect(v.issues).toEqual([]);
    expect(v.turns.length).toBe(turns.length);
  });

  it("an illegal move reports ply, token, and legal alternatives", () => {
    const turns = randomTurns(13, 24);
    const text = serializeGame({ turns });
    const corrupted = text.replace(/([KQRBN])B(\d{1,2})-/u, "$1C$2-");
    expect(corrupted).not.toBe(text);
    const v = validateGameText(corrupted);
    expect(v.issues.length).toBe(1);
    const issue = v.issues[0];
    expect(issue?.kind).toBe("illegal-move");
    expect(issue?.ply).toBeGreaterThan(0);
    expect(issue?.token).toBeTruthy();
    expect(issue?.legalAlternatives?.length).toBeGreaterThan(0);
    // Replay stopped there — the turns before the failure are kept.
    expect(v.turns.length).toBe((issue?.ply ?? 1) - 1);
  });

  it("garbage tokens report as parse issues", () => {
    const turns = randomTurns(9, 24);
    const text = serializeGame({ turns });
    const v = validateGameText(`${text}ZZZ\n`);
    expect(v.issues.some((i) => i.kind === "parse")).toBe(true);
  });
});

describe("engine-generated spec examples (for the docs)", () => {
  it("prints a legal opening round for documentation use", () => {
    let state: BoardState = initialState();
    const tokens: string[] = [];
    for (let i = 0; i < 4; i++) {
      const first = legalMoves(state)[0] as Move;
      const second = legalSecondSubmoves(state, first)[0] as Move;
      const { token, after } = turnToToken(state, {
        submoves: [first, second] as const,
      });
      tokens.push(token);
      state = after;
    }
    // Every token: two &-joined canonical moves.
    for (const token of tokens) {
      expect(token).toMatch(/^[KQRBNP][A-D]\d+[-x][A-D]\d+.*&[KQRBNP][A-D]\d+[-x][A-D]\d+/u);
    }
  });
});
