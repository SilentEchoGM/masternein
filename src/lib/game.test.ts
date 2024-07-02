import { describe, expect, it } from "vitest";
import { compareRack } from "./game";

describe("game", () => {
  it("should compare racks", () => {
    expect(
      compareRack(["red", "green", "blue", "orange"])([
        "gray",
        "green",
        "blue",
        "orange",
      ])
    ).toEqual({
      singleCount: 0,
      doubleCount: 3,
    });

    expect(
      compareRack(["orange", "black", "gray", "gray"])([
        "black",
        "black",
        "orange",
        "black",
      ])
    ).toEqual({
      singleCount: 1,
      doubleCount: 1,
    });
  });
});
