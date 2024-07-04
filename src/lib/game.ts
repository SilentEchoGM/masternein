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

export const PlayerSchema = Schema.Struct({
  id: Schema.String,
  displayName: Schema.String,
  host: Schema.Boolean,
});

export type Player = typeof PlayerSchema.Type;

export type Colour = typeof ColourSchema.Type;

export const colours: Record<Colour, string> = {
  red: "#E23C3C",
  green: "#00ff00",
  blue: "#0099ff",
  orange: "#ffa500",
  gray: "#808080",
  white: "#ffffff",
  black: "#000000",
  pink: "#F98BC4",
  purple: "#8A4FBA",
} as const;

export const getNextColour =
  (possible: Colour[]) =>
  (colour: Colour): Colour =>
    pipe(
      possible,
      Array.findFirstIndex((c) => c === colour),
      Option.flatMap((i) => Array.get(possible, i + 1)),
      Option.getOrElse(() => possible[0])
    );

export const getPreviousColour =
  (possible: Colour[]) =>
  (colour: Colour): Colour =>
    pipe(
      possible,
      Array.findFirstIndex((c) => c === colour),
      Option.flatMap((i) => Array.get(possible, i - 1)),
      Option.getOrElse(() => possible[possible.length - 1])
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

    const attemptColourCount = pipe(
      attempt,
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

        return acc + Math.min(count, correctColourCount[colour] ?? 0);
      })
    );

    const doubleCount = Array.filter(
      attempt,
      (colour, i) => correct[i] === colour
    ).length;

    return {
      singleCount: singleCount - doubleCount,
      doubleCount: doubleCount,
    };
  };

export const isWinningRack = (correct: Rack) => (attempt: Rack) =>
  compareRack(correct)(attempt).doubleCount === correct.length;

export const isEqualRack = (correct: Rack) => (attempt: Rack) =>
  pipe(
    correct,
    Array.filter((colour, i) => attempt[i] === colour),
    Array.length,
    (len) => len === correct.length
  );

export const randomRack = (): Rack =>
  pipe(
    () => Math.floor(Math.random() * ColourSchema.literals.length),
    Array.replicate(4),
    Array.map((fn) => fn()),
    Array.map((i) => ColourSchema.literals[i])
  ) as Rack;
