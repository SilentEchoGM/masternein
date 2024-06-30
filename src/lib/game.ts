import { Schema } from "@effect/schema";
import { Array, Option, pipe } from "effect";
import type { Rack } from "./types";

export const ColourSchema = Schema.Literal(
  "red",
  "green",
  "blue",
  "orange",
  "gray",
  "white",
  "black",
  "pink",
  "purple"
);

export type Colour = typeof ColourSchema.Type;

export const colours: Record<Colour, string> = {
  red: "#E23C3C",
  green: "#00ff00",
  blue: "#0099ff",
  orange: "#ffa500",
  gray: "#808080",
  white: "#ffffff",
  black: "#000000",
  pink: "#F653A6",
  purple: "#8A4FBA",
} as const;

export const getNextColour = (colour: Colour): Colour =>
  pipe(
    ColourSchema.literals,
    Array.findFirstIndex((c) => c === colour),
    Option.flatMap((i) => Array.get(ColourSchema.literals, i + 1)),
    Option.getOrElse(() => ColourSchema.literals[0])
  );

export const getPreviousColour = (colour: Colour): Colour =>
  pipe(
    ColourSchema.literals,
    Array.findFirstIndex((c) => c === colour),
    Option.flatMap((i) => Array.get(ColourSchema.literals, i - 1)),
    Option.getOrElse(
      () => ColourSchema.literals[ColourSchema.literals.length - 1]
    )
  );

export const compareRack =
  (correct: Rack) =>
  (
    attempt: Rack
  ): {
    singleCount: number;
    doubleCount: number;
  } => {
    const correctColourCount = pipe(
      correct,
      Array.reduce(
        {} as { [Property in Colour]?: number },
        (acc, colour, i) => {
          return { ...acc, [colour]: (acc[colour] || 0) + 1 };
        }
      )
    );

    const correctColours = new Set(correct);

    const singleCount = pipe(
      correctColours,
      Array.reduce(0, (acc, colour) => {
        const count = Array.filter(attempt, (c) => c === colour).length;
        console.log(`count ${colour}`, count, correctColourCount[colour]);

        return acc + count;
      })
    );
    console.log("singleCount", {
      singleCount,
      correctColours,
      correctColourCount,
    });

    const doubleCount = Array.filter(
      attempt,
      (colour, i) => correct[i] === colour
    ).length;

    return {
      singleCount: singleCount - doubleCount,
      doubleCount: doubleCount,
    };
  };

console.log(
  "compareRack",
  compareRack(["red", "green", "blue", "orange"])([
    "gray",
    "green",
    "blue",
    "orange",
  ])
);

export const isWinningRack = (correct: Rack) => (attempt: Rack) =>
  compareRack(correct)(attempt).doubleCount === correct.length;

export const isEqualRack = (correct: Rack) => (attempt: Rack) =>
  pipe(
    correct,
    Array.filter((colour, i) => attempt[i] === colour),
    Array.length,
    (len) => len === correct.length
  );
