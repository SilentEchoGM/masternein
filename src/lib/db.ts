import { Schema } from "@effect/schema";
import { Effect, pipe } from "effect";
import localforage from "localforage";
import { v4 } from "uuid";

const { getItem, setItem } = localforage;

export const getPlayerId = pipe(
  Effect.tryPromise(() => getItem("playerId")),
  Effect.flatMap(Schema.decodeUnknown(Schema.String)),
  Effect.tap((v) => console.log("💾: playerId", v)),
  Effect.orElse(() => Effect.tryPromise(() => setItem("playerId", v4())))
);
