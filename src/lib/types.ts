import type { TupleOf } from "effect/Types";
import type { Colour, Player } from "./game";

export type Rack = TupleOf<4, Colour>;

export type Attempt = {
  rack: Rack;
  single: number;
  double: number;
  i: number;
};

export type HostPacket = {
  rack: TupleOf<4, Colour>;
  attempts: Array<Attempt>;
  colours: Array<Colour>;
  playerList: Array<Player>;
  attemptLimit: number;
};

export type PlayerPacket = {
  rack: TupleOf<4, Colour>;
  colours: Array<Colour>;
};

export type ServerToClientEvents = {
  ended: (params: { success: boolean }) => void;
  error: (params: { message: string }) => void;
  "in-room": (params: { roomCode: string }) => void;
  "request-state": () => void;
  "host-state": (params: HostPacket, started?: boolean) => void;
  "player-state": (params: PlayerPacket) => void;
  "set-code": () => void;
  attempt: (params: { rack: Rack }) => void;
  "host-disconnected": () => void;
  "new-game": () => void;
  "new-player": (params: { player: Player }) => void;
  "update-player": (params: { player: Player }) => void;
  "make-host": () => void;
};

export type ClientToServerEvents = {
  host: (params: { roomCode: string }) => void;
  join: (params: { roomCode: string; player: Player }) => void;
  ended: (params: { success: boolean }) => void;
  "host-state": (params: HostPacket, started?: boolean) => void;
  "player-state": (params: PlayerPacket) => void;
  "set-code": () => void;
  attempt: (params: { rack: Rack }) => void;
  "new-game": () => void;
  "update-player": (params: { player: Player }) => void;
  "make-player-host": (params: { player: Player }) => void;
};

export type InterServerEvents = {};

export type SocketData = {
  playerId: string;
  host: boolean;
  roomCode: string;
};
