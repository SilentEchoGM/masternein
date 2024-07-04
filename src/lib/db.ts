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

export const getPlayerDisplayName = pipe(
  Effect.tryPromise(() => getItem("playerDisplayName")),
  Effect.flatMap(Schema.decodeUnknown(Schema.String)),
  Effect.tap((v) => console.log("💾: playerDisplayName", v)),
  Effect.orElse(() =>
    Effect.tryPromise(() => setItem("playerDisplayName", "Player"))
  )
);

export const setPlayerDisplayName = (displayName: string) =>
  pipe(
    Effect.tryPromise(() => setItem("playerDisplayName", displayName)),
    Effect.map(() => displayName)
  );

export const getPlayerData = pipe(
  [getPlayerId, getPlayerDisplayName],
  Effect.all,
  Effect.map(([playerId, playerDisplayName]) => ({
    playerId,
    playerDisplayName,
  }))
);
