import { describe, expect, it } from "vitest";
import {
  FILE_COUNT,
  RANK_COUNT,
  SQUARE_COUNT,
  fileOf,
  rankOf,
  squareColor,
  squareOf,
  wrapRank,
} from "../src/geometry.js";

describe("wrapRank", () => {
  it("is identity on 0–31", () => {
    for (let r = 0; r < RANK_COUNT; r++) expect(wrapRank(r)).toBe(r);
  });

  it("wraps negatives correctly (the JS % trap)", () => {
    expect(wrapRank(-1)).toBe(31);
    expect(wrapRank(-32)).toBe(0);
    expect(wrapRank(-33)).toBe(31);
  });

  it("wraps overflow correctly", () => {
    expect(wrapRank(32)).toBe(0);
    expect(wrapRank(63)).toBe(31);
    expect(wrapRank(64)).toBe(0);
  });
});

describe("square encoding", () => {
  it("round-trips all 128 squares", () => {
    for (let r = 0; r < RANK_COUNT; r++) {
      for (let f = 0; f < FILE_COUNT; f++) {
        const sq = squareOf(r, f);
        expect(rankOf(sq)).toBe(r);
        expect(fileOf(sq)).toBe(f);
      }
    }
  });

  it("covers exactly 0..127 with no collisions", () => {
    const seen = new Set<number>();
    for (let r = 0; r < RANK_COUNT; r++) {
      for (let f = 0; f < FILE_COUNT; f++) seen.add(squareOf(r, f));
    }
    expect(seen.size).toBe(SQUARE_COUNT);
    expect(Math.min(...seen)).toBe(0);
    expect(Math.max(...seen)).toBe(SQUARE_COUNT - 1);
  });
});

describe("squareColor", () => {
  it("closes the checkerboard around the 32↔1 junction", () => {
    // Neighbors along a file (same file, adjacent rank) always alternate,
    // including across the wrap — 32 ranks is even, so this must hold.
    for (let f = 0; f < FILE_COUNT; f++) {
      for (let r = 0; r < RANK_COUNT; r++) {
        const here = squareColor(squareOf(r, f));
        const next = squareColor(squareOf(wrapRank(r + 1), f));
        expect(here).not.toBe(next);
      }
    }
  });

  it("alternates radially between adjacent files", () => {
    for (let r = 0; r < RANK_COUNT; r++) {
      for (let f = 0; f < FILE_COUNT - 1; f++) {
        expect(squareColor(squareOf(r, f))).not.toBe(
          squareColor(squareOf(r, f + 1)),
        );
      }
    }
  });
});
