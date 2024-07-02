import { Array, Effect, Option, Tuple, pipe } from "effect";
import { assign, createActor, fromPromise, log, raise, setup } from "xstate";
import { getPlayerId } from "./db";
import {
  ColourSchema,
  compareRack,
  getNextColour,
  getPreviousColour,
  isWinningRack,
} from "./game";
import {
  sendAttempt,
  sendEnded,
  sendHost,
  sendHostState,
  sendJoin,
  sendNewGame,
  sendPlayerState,
  sendSetCode,
} from "./socket";
import type { Attempt, GamePacket, Rack } from "./types";

const defaultRack: Rack = [
  ColourSchema.literals[0],
  ColourSchema.literals[1],
  ColourSchema.literals[2],
  ColourSchema.literals[3],
];

export const GAME = pipe(
  setup({
    types: {} as {
      context: {
        code: Option.Option<Rack>;
        attempts: Array<Attempt>;
        room: Option.Option<string>;
        playerId: Option.Option<string>;
        rack: Rack;
        limit: number;
      };
      events:
        | {
            type: "set_code";
          }
        | { type: "attempt"; params: { rack: Rack } }
        | { type: "host" | "join"; params: { roomCode: string } }
        | { type: "error"; message: string }
        | { type: "inc_rack" | "dec_rack"; params: { i: number } }
        | { type: "connected"; params: { roomCode: string } }
        | { type: "host_state"; params: GamePacket; started?: boolean }
        | { type: "host_disconnected" }
        | { type: "replace_rack"; params: { rack: Rack } }
        | { type: "new_game" }
        | { type: "ended"; params: { success: boolean } }
        | {
            type: "player_state";
            params: GamePacket;
          };
    },
    guards: {
      isCorrect: (
        _,
        { correct, rack }: { correct: Option.Option<Rack>; rack: Rack }
      ) => Option.isSome(correct) && isWinningRack(correct.value)(rack),
    },
    actions: {
      sendJoin: (_, { roomCode }: { roomCode: string }) => sendJoin(roomCode),
      sendHost: (_, { roomCode }: { roomCode: string }) => sendHost(roomCode),
      sendAttempt: (_, { rack }: { rack: Rack }) => sendAttempt(rack),
      sendNewGame: () => sendNewGame(),
      incRack: assign({
        rack: ({ context: { rack } }, { i }: { i: number }) =>
          pipe(rack, Array.replace(i, getNextColour(rack[i])), (arr) =>
            Tuple.isTupleOf(arr, 4) ? arr : rack
          ) satisfies Rack,
      }),
      decRack: assign({
        rack: ({ context: { rack } }, { i }: { i: number }) =>
          pipe(rack, Array.replace(i, getPreviousColour(rack[i])), (arr) =>
            Tuple.isTupleOf(arr, 4) ? arr : rack
          ) satisfies Rack,
      }),
      sendHostState: (_, params: GamePacket) => sendHostState(params),
      sendPlayerState: (_, params: GamePacket) => sendPlayerState(params),
      sendSetCode: () => sendSetCode(),
      sendEnded: (_, { success }: { success: boolean }) => sendEnded(success),
      processAttempt: assign({
        attempts: (
          { context: { code, attempts } },
          { rack }: { rack: Rack }
        ) => {
          if (Option.isNone(code)) throw new Error("code is not set");

          const { singleCount, doubleCount } = compareRack(code.value)(rack);

          return [
            ...attempts,
            {
              rack,
              single: singleCount,
              double: doubleCount,
              i: attempts.length,
            },
          ];
        },
      }),
    },
    actors: {
      getPlayerId: fromPromise(() => Effect.runPromise(getPlayerId)),
    },
  }).createMachine({
    context: {
      code: Option.none(),
      attempts: [],
      room: Option.none(),
      playerId: Option.none(),
      rack: defaultRack,
      limit: 1,
    },
    invoke: {
      src: "getPlayerId",
      id: "getPlayerId",
      onDone: {
        actions: assign({
          playerId: ({ event }) => Option.some(event.output),
        }),
      },
      onError: {
        actions: [
          log("error getting player id"),
          raise({
            type: "error",
            message: "error getting a player id for you",
          }),
        ],
      },
    },
    initial: "menu",
    states: {
      menu: {
        on: {
          host: {
            target: "host",
            actions: {
              type: "sendHost",
              params: ({ event }) => ({ roomCode: event.params.roomCode }),
            },
          },
          join: {
            target: "player",
            actions: {
              type: "sendJoin",
              params: ({ event }) => ({ roomCode: event.params.roomCode }),
            },
          },
        },
      },
      player: {
        initial: "connecting",
        on: {
          host_disconnected: {
            target: "menu",
            actions: assign({
              room: Option.none(),
              rack: defaultRack,
              attempts: [],
            }),
          },
        },
        states: {
          connecting: {
            on: {
              connected: {
                target: "waiting",
                actions: assign({
                  room: ({ event }) => Option.some(event.params.roomCode),
                }),
              },
            },
          },
          waiting: {
            on: {
              host_state: [
                {
                  actions: assign({
                    rack: ({ event }) => event.params.rack,
                    attempts: ({ event }) => event.params.attempts,
                  }),
                  guard: ({ event }) => !!event.started,
                  target: "active",
                },
                {
                  actions: assign({
                    rack: ({ event }) => event.params.rack,
                    attempts: ({ event }) => event.params.attempts,
                  }),
                  target: "inactive",
                },
              ],
            },
          },
          active: {
            on: {
              attempt: {
                actions: [
                  { type: "sendAttempt", params: ({ event }) => event.params },
                ],
              },
              inc_rack: {
                actions: [
                  { type: "incRack", params: ({ event }) => event.params },
                  {
                    type: "sendPlayerState",
                    params: ({ context }) => ({
                      rack: context.rack,
                      attempts: context.attempts,
                    }),
                  },
                ],
              },
              dec_rack: {
                actions: [
                  { type: "decRack", params: ({ event }) => event.params },
                  {
                    type: "sendPlayerState",
                    params: ({ context }) => ({
                      rack: context.rack,
                      attempts: context.attempts,
                    }),
                  },
                ],
              },
              replace_rack: {
                actions: [
                  assign({
                    rack: ({ event }) => event.params.rack,
                  }),
                  {
                    type: "sendPlayerState",
                    params: ({ context }) => ({
                      rack: context.rack,
                      attempts: context.attempts,
                    }),
                  },
                ],
              },
              host_state: {
                actions: assign({
                  rack: ({ event }) => event.params.rack,
                  attempts: ({ event }) => event.params.attempts,
                }),
              },
              ended: [
                {
                  target: "ended.success",
                  guard: ({ event }) => event.params.success,
                },
                {
                  target: "ended.failure",
                },
              ],
            },
          },
          inactive: {
            on: {
              set_code: "active",
            },
          },
          ended: {
            initial: "failure",
            on: {
              new_game: {
                target: "inactive",
                actions: assign({
                  rack: defaultRack,
                  attempts: [],
                }),
              },
            },
            states: {
              success: {},
              failure: {},
            },
          },
        },
      },
      host: {
        initial: "connecting",
        states: {
          connecting: {
            on: {
              connected: {
                target: "active",
                actions: assign({
                  room: ({ event }) => Option.some(event.params.roomCode),
                }),
              },
            },
          },
          inactive: {
            on: {
              player_state: {
                actions: [
                  assign({
                    rack: ({ event }) => event.params.rack,
                  }),
                  {
                    type: "sendHostState",
                    params: ({ context }) => ({
                      rack: context.rack,
                      attempts: context.attempts,
                    }),
                  },
                ],
              },
              attempt: [
                {
                  guard: {
                    type: "isCorrect",
                    params: ({ event, context }) => ({
                      correct: context.code,
                      rack: event.params.rack,
                    }),
                  },
                  target: "ended.success",
                  actions: [{ type: "sendEnded", params: { success: true } }],
                },
                {
                  guard: ({ context }) =>
                    context.attempts.length + 1 >= context.limit,
                  target: "ended.failure",
                  actions: [{ type: "sendEnded", params: { success: false } }],
                },
                {
                  actions: [
                    {
                      type: "processAttempt",
                      params: ({ event }) => event.params,
                    },
                    {
                      type: "sendHostState",
                      params: ({ context }) => ({
                        rack: context.rack,
                        attempts: context.attempts,
                      }),
                    },
                  ],
                },
              ],
            },
          },
          active: {
            on: {
              set_code: {
                target: "inactive",
                actions: [
                  assign({
                    code: ({ context }) => Option.some(context.rack),
                    rack: defaultRack,
                  }),
                  "sendSetCode",
                ],
              },
              inc_rack: {
                actions: [
                  { type: "incRack", params: ({ event }) => event.params },
                ],
              },
              dec_rack: {
                actions: [
                  { type: "decRack", params: ({ event }) => event.params },
                ],
              },
            },
          },
          ended: {
            initial: "failure",
            on: {
              new_game: {
                target: "active",
                actions: [
                  assign({
                    rack: defaultRack,
                    attempts: [],
                    code: Option.none(),
                  }),
                  "sendNewGame",
                ],
              },
            },
            states: {
              success: {},
              failure: {},
            },
          },
        },
      },
    },
  }),
  (logic) => {
    const actor = createActor(logic);
    actor.start();

    let _snapshot = $state(actor.getSnapshot());
    let _context = $state(actor.getSnapshot().context);
    let _value = $state(actor.getSnapshot().value);

    actor.subscribe((snap) => {
      _snapshot = snap;
      _context = snap.context;
      _value = snap.value;
    });

    return {
      send: actor.send,
      get snapshot() {
        return _snapshot;
      },
      get context() {
        return _context;
      },
      get value() {
        return _value;
      },
    };
  }
);
