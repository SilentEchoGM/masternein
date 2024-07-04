import { Array, Effect, Option, Tuple, pipe } from "effect";
import {
  assign,
  createActor,
  enqueueActions,
  fromPromise,
  log,
  raise,
  setup,
} from "xstate";
import { getPlayerData, setPlayerDisplayName } from "./db";
import {
  ColourSchema,
  compareRack,
  getNextColour,
  getPreviousColour,
  isWinningRack,
  type Colour,
  type Player,
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
  sendUpdatePlayer,
} from "./socket";
import type { Attempt, HostPacket, PlayerPacket, Rack } from "./types";

const defaultRack: Rack = [
  ColourSchema.literals[0],
  ColourSchema.literals[1],
  ColourSchema.literals[2],
  ColourSchema.literals[3],
];

type MachineEvents =
  | {
      type: "set_code" | "make_host" | "host_disconnected" | "new_game";
    }
  | {
      type: "attempt" | "replace_rack";
      params: {
        rack: Rack;
      };
    }
  | {
      type: "host" | "join" | "connected";
      params: {
        roomCode: string;
      };
    }
  | {
      type: "error";
      message: string;
    }
  | {
      type: "inc_rack" | "dec_rack";
      params: {
        i: number;
      };
    }
  | {
      type: "host_state";
      params: HostPacket;
      started?: boolean;
    }
  | {
      type: "ended";
      params: {
        success: boolean;
      };
    }
  | {
      type: "toggle_colour";
      params: {
        colour: Colour;
      };
    }
  | {
      type: "new_display_name";
      params: {
        displayName: string;
      };
    }
  | {
      type: "set_attempt_limit";
      params: {
        attemptLimit: number;
      };
    }
  | {
      type: "new_player" | "update_player" | "make_player_host";
      params: {
        player: Player;
      };
    }
  | {
      type: "player_state";
      params: PlayerPacket;
    };

export const GAME = pipe(
  setup({
    types: {} as {
      context: {
        code: Option.Option<Rack>;
        attempts: Array<Attempt>;
        room: Option.Option<string>;
        playerId: string;
        playerDisplayName: string;
        rack: Rack;
        attemptLimit: number;
        colours: Array<Colour>;
        playerList: Array<Player>;
      };
      events: MachineEvents;
    },
    guards: {
      isCorrect: (
        _,
        { correct, rack }: { correct: Option.Option<Rack>; rack: Rack }
      ) => Option.isSome(correct) && isWinningRack(correct.value)(rack),
    },
    actions: {
      sendJoin: (
        _,
        {
          roomCode,
          id,
          displayName,
        }: { roomCode: string; id: string; displayName: string }
      ) =>
        sendJoin(roomCode, {
          id,
          displayName,
          host: false,
        }),
      sendHost: (_, { roomCode }: { roomCode: string }) => sendHost(roomCode),
      sendAttempt: (_, { rack }: { rack: Rack }) => sendAttempt(rack),
      sendNewGame: () => sendNewGame(),
      incRack: assign({
        rack: ({ context: { rack, colours } }, { i }: { i: number }) =>
          pipe(rack, Array.replace(i, getNextColour(colours)(rack[i])), (arr) =>
            Tuple.isTupleOf(arr, 4) ? arr : rack
          ) satisfies Rack,
      }),
      decRack: assign({
        rack: ({ context: { rack, colours } }, { i }: { i: number }) =>
          pipe(
            rack,
            Array.replace(i, getPreviousColour(colours)(rack[i])),
            (arr) => (Tuple.isTupleOf(arr, 4) ? arr : rack)
          ) satisfies Rack,
      }),
      sendHostState: ({ context }) =>
        sendHostState({
          rack: context.rack,
          attempts: context.attempts,
          colours: context.colours,
          playerList: context.playerList,
          attemptLimit: context.attemptLimit,
        }),
      sendPlayerState: (_, params: PlayerPacket) => sendPlayerState(params),
      sendSetCode: () => sendSetCode(),
      sendEnded: (_, { success }: { success: boolean }) => sendEnded(success),
      sendUpdatePlayer: (_, { player }: { player: Player }) =>
        sendUpdatePlayer(player),
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
      toggleColour: assign({
        colours: ({ context }, { colour }: { colour: Colour }) =>
          Array.some(context.colours, (c) => c === colour)
            ? Array.filter(context.colours, (c) => c !== colour)
            : [...context.colours, colour],
      }),
      reset: assign({
        attempts: [],
        colours: [...ColourSchema.literals],
        rack: defaultRack,
        room: Option.none(),
        code: Option.none(),
      }),
    },
    actors: {
      getPlayerData: fromPromise(() => Effect.runPromise(getPlayerData)),
      setPlayerDisplayName: fromPromise(({ input }: { input: string }) =>
        Effect.runPromise(setPlayerDisplayName(input))
      ),
    },
  }).createMachine({
    context: {
      code: Option.none(),
      attempts: [],
      room: Option.none(),
      playerId: "",
      rack: defaultRack,
      attemptLimit: 10,
      colours: [...ColourSchema.literals],
      playerDisplayName: "",
      playerList: [],
    },
    invoke: {
      src: "getPlayerData",
      id: "getPlayerData",
      onDone: {
        actions: assign(({ event }) => ({
          playerId: event.output.playerId,
          playerDisplayName: event.output.playerDisplayName,
        })),
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
    on: {
      new_display_name: {
        actions: [
          enqueueActions(({ enqueue, context, event, self }) => {
            const isHost = self.getSnapshot().matches("host");
            const isPlayer = self.getSnapshot().matches("player");

            enqueue.assign({
              playerDisplayName: ({ event }) => event.params.displayName,
            });

            enqueue.spawnChild("setPlayerDisplayName", {
              input: event.params.displayName,
            });

            if (isHost || isPlayer) {
              sendUpdatePlayer({
                id: context.playerId,
                displayName: event.params.displayName,
                host: isHost,
              });
            }
          }),
        ],
      },
    },
    states: {
      menu: {
        on: {
          host: {
            target: "host",
            actions: [
              {
                type: "sendHost",
                params: ({ event }) => ({ roomCode: event.params.roomCode }),
              },
              assign({
                playerList: ({ context }) => [
                  {
                    id: context.playerId,
                    displayName: context.playerDisplayName,
                    host: true,
                  },
                ],
              }),
            ],
          },
          join: {
            target: "player",
            actions: {
              type: "sendJoin",
              params: ({ event, context }) => ({
                roomCode: event.params.roomCode,
                id: context.playerId,
                displayName: context.playerDisplayName,
              }),
            },
          },
        },
      },
      player: {
        initial: "connecting",
        on: {
          host_disconnected: {
            target: "menu",
            actions: "reset",
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
                    attemptLimit: ({ event }) => event.params.attemptLimit,
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
                      colours: context.colours,
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
                      colours: context.colours,
                    }),
                  },
                ],
              },
              toggle_colour: {
                actions: [
                  { type: "toggleColour", params: ({ event }) => event.params },
                  {
                    type: "sendPlayerState",
                    params: ({ context }) => ({
                      rack: context.rack,
                      attempts: context.attempts,
                      colours: context.colours,
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
                      colours: context.colours,
                    }),
                  },
                ],
              },
              host_state: {
                actions: assign({
                  rack: ({ event }) => event.params.rack,
                  attempts: ({ event }) => event.params.attempts,
                  attemptLimit: ({ event }) => event.params.attemptLimit,
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
                actions: "reset",
              },
              make_host: {
                target: "..host",
                actions: [
                  assign({
                    playerList: ({ context }) => [
                      {
                        id: context.playerId,
                        displayName: context.playerDisplayName,
                        host: true,
                      },
                      ...pipe(
                        context.playerList,
                        Array.filter((p) => p.id !== context.playerId),
                        Array.map((p) => ({ ...p, host: false }))
                      ),
                    ],
                  }),
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
      host: {
        initial: "connecting",
        on: {
          new_player: {
            actions: [
              assign({
                playerList: ({ event, context }) => [
                  ...context.playerList,
                  event.params.player,
                ],
              }),
              "sendHostState",
            ],
          },
          update_player: {
            actions: [
              assign({
                playerList: ({ event, context }) =>
                  pipe(
                    context.playerList,
                    Array.filter((p) => p.id !== event.params.player.id),
                    (arr) => [...arr, event.params.player]
                  ),
              }),
              "sendHostState",
            ],
          },
        },
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
                    colours: ({ event }) => event.params.colours,
                  }),
                  "sendHostState",
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
                    context.attempts.length + 1 >= context.attemptLimit,
                  target: "ended.failure",
                  actions: [{ type: "sendEnded", params: { success: false } }],
                },
                {
                  actions: [
                    {
                      type: "processAttempt",
                      params: ({ event }) => event.params,
                    },
                    "sendHostState",
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
              replace_rack: {
                actions: [
                  assign({
                    rack: ({ event }) => event.params.rack,
                  }),
                ],
              },
              set_attempt_limit: {
                actions: [
                  assign({
                    attemptLimit: ({ event }) => event.params.attemptLimit,
                  }),
                  "sendHostState",
                ],
              },
            },
          },
          ended: {
            initial: "failure",
            on: {
              new_game: {
                target: "active",
                actions: ["reset", "sendNewGame"],
              },
              make_player_host: {
                target: "..player",
                actions: [
                  assign({
                    playerList: ({ event, context }) =>
                      pipe(
                        context.playerList,
                        Array.filter((p) => p.id !== event.params.player.id),
                        Array.filter((p) => !p.host),
                        (arr): Player[] => [
                          ...arr,
                          { ...event.params.player, host: true },
                          {
                            displayName: context.playerDisplayName,
                            id: context.playerId,
                            host: false,
                          },
                        ]
                      ),
                  }),
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
      get displayName() {
        if (_context.playerDisplayName.length === 0) {
          return "Player";
        }
        return _context.playerDisplayName;
      },
      set displayName(displayName: string) {
        if (!displayName || displayName.length === 0) {
          return;
        }

        actor.send({
          type: "new_display_name",
          params: {
            displayName,
          },
        });
      },
      get attemptLimit() {
        return _context.attemptLimit;
      },
      set attemptLimit(attemptLimit: number) {
        if (!attemptLimit || attemptLimit < 1) {
          return;
        }

        actor.send({
          type: "set_attempt_limit",
          params: {
            attemptLimit,
          },
        });
      },
    };
  }
);
