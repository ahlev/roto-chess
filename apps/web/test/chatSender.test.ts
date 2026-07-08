import { describe, expect, it } from "vitest";
import { resolveSender } from "../src/lib/game/chatSender";

const seats = [
  { seat: 1 as const, userId: "u-north" },
  { seat: 3 as const, userId: "u-south" },
];
const observers = [{ userId: "u-watch", displayName: "Ava" }];

describe("resolveSender", () => {
  it("a seated sender gets their seat and no observer flag", () => {
    expect(resolveSender("u-north", seats, observers)).toEqual({
      seat: 1,
      observing: false,
    });
  });
  it("an observer gets the flag and no seat", () => {
    expect(resolveSender("u-watch", seats, observers)).toEqual({
      seat: null,
      observing: true,
    });
  });
  it("a seat wins over a stale observer row", () => {
    expect(
      resolveSender(
        "u-north",
        seats,
        [{ userId: "u-north", displayName: "N" }],
      ),
    ).toEqual({ seat: 1, observing: false });
  });
  it("an unknown sender (departed member) gets neither", () => {
    expect(resolveSender("u-ghost", seats, observers)).toEqual({
      seat: null,
      observing: false,
    });
  });
});
