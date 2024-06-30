import type { TupleOf } from "effect/Types";
import type { Colour } from "./game";

export type Rack = TupleOf<4, Colour>;

export type Attempt = {
  rack: Rack;
  single: number;
  double: number;
  i: number;
};

export type GamePacket = {
  rack: TupleOf<4, Colour>;
  attempts: Array<Attempt>;
};

export type ServerToClientEvents = {
  ended: (params: { success: boolean }) => void;
  error: (params: { message: string }) => void;
  "in-room": (params: { roomCode: string }) => void;
  "request-state": () => void;
  "host-state": (params: GamePacket, started?: boolean) => void;
  "player-state": (params: GamePacket) => void;
  "set-code": () => void;
  attempt: (params: { rack: Rack }) => void;
  "host-disconnected": () => void;
};

export type ClientToServerEvents = {
  host: (params: { roomCode: string }) => void;
  join: (params: { roomCode: string }) => void;
  ended: (params: { success: boolean }) => void;
  "host-state": (params: GamePacket, started?: boolean) => void;
  "player-state": (params: GamePacket) => void;
  "set-code": () => void;
  attempt: (params: { rack: Rack }) => void;
};

export type InterServerEvents = {};

export type SocketData = {
  playerId: string;
  host: boolean;
  roomCode: string;
};
