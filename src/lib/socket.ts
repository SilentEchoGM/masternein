import { browser, dev } from "$app/environment";
import { Effect, Option } from "effect";
import { Socket, io } from "socket.io-client";
import { getPlayerId } from "./db";
import type { Player } from "./game";
import { GAME } from "./machine.svelte";
import type {
  ClientToServerEvents,
  HostPacket,
  PlayerPacket,
  Rack,
  ServerToClientEvents,
} from "./types";

export const socket: {
  conn: Option.Option<Socket<ServerToClientEvents, ClientToServerEvents>>;
} = {
  conn: Option.none(),
};

const connectSocket = async () => {
  if (!browser) return;

  const _socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    dev
      ? `http://localhost:${import.meta.env.VITE_SOCKET_PORT}`
      : `https://masternein.silentecho.eu`,
    {
      query: {
        playerId: await Effect.runPromise(getPlayerId),
      },
    }
  );

  _socket.on("connect", () => {
    console.log("📡✔️");
    socket.conn = Option.some(_socket);
  });

  _socket.on("in-room", ({ roomCode }) => {
    console.log("🕹️✔️");

    GAME.send({
      type: "connected",
      params: {
        roomCode,
      },
    });
  });

  _socket.on("player-state", ({ rack, colours }) => {
    console.log("📋 player-state", rack);

    GAME.send({
      type: "player_state",
      params: {
        rack,

        colours,
      },
    });
  });

  _socket.on(
    "host-state",
    ({ rack, attempts, colours, playerList }, started = false) => {
      console.log("📋host-state", rack);

      GAME.send({
        type: "host_state",
        params: {
          rack,
          attempts,
          colours,
          playerList,
        },
        started,
      });
    }
  );

  _socket.on("request-state", () => {
    console.log("❔");
    _socket.emit(
      "host-state",
      {
        rack: GAME.context.rack,
        attempts: GAME.context.attempts,
        colours: GAME.context.colours,
        playerList: GAME.context.playerList,
      },
      Option.isSome(GAME.context.code)
    );
  });

  _socket.on("set-code", () => {
    console.log("🔄");
    GAME.send({
      type: "set_code",
    });
  });

  _socket.on("attempt", ({ rack }) => {
    console.log("🔄", rack);
    GAME.send({
      type: "attempt",
      params: {
        rack,
      },
    });
  });

  _socket.on("ended", ({ success }) => {
    console.log("📋 success?", success);

    GAME.send({
      type: "ended",
      params: {
        success,
      },
    });
  });

  _socket.on("host-disconnected", () => {
    console.log("📡❌ host disconnected");
    GAME.send({
      type: "host_disconnected",
    });
  });

  _socket.on("disconnect", () => {
    console.log("📡❌ disconnected");
  });

  _socket.on("error", ({ message }) => {
    console.error("❗📡❌ error", message);
  });

  _socket.on("new-game", () => {
    console.log("📡✔️");
    GAME.send({
      type: "new_game",
    });
  });

  _socket.on("make-host", () => {
    console.log("📡✔️");
    GAME.send({
      type: "make_host",
    });
  });

  _socket.on("new-player", ({ player }) => {
    GAME.send({
      type: "new_player",
      params: {
        player,
      },
    });
  });
};

connectSocket();

export const sendJoin = (roomCode: string, player: Player) => {
  if (Option.isNone(socket.conn)) {
    console.error("socket is not connected");
    return;
  }

  socket.conn.value.emit("join", {
    roomCode,
    player,
  });
};

export const sendHost = (roomCode: string) => {
  if (Option.isNone(socket.conn)) {
    console.error("socket is not connected");
    return;
  }

  socket.conn.value.emit("host", {
    roomCode,
  });
};

export const sendPlayerState = (packet: PlayerPacket) => {
  if (Option.isNone(socket.conn)) {
    console.error("socket is not connected");
    return;
  }

  socket.conn.value.emit("player-state", packet);
};

export const sendHostState = (packet: HostPacket) => {
  console.log("📋sendHostState", packet);
  if (Option.isNone(socket.conn)) {
    console.error("socket is not connected");
    return;
  }

  socket.conn.value.emit("host-state", packet);
};

export const sendSetCode = () => {
  if (Option.isNone(socket.conn)) {
    console.error("socket is not connected");
    return;
  }

  socket.conn.value.emit("set-code");
};

export const sendAttempt = (rack: Rack) => {
  if (Option.isNone(socket.conn)) {
    console.error("socket is not connected");
    return;
  }

  socket.conn.value.emit("attempt", {
    rack,
  });
};

export const sendEnded = (success: boolean) => {
  if (Option.isNone(socket.conn)) {
    console.error("socket is not connected");
    return;
  }

  socket.conn.value.emit("ended", {
    success,
  });
};

export const sendNewGame = () => {
  if (Option.isNone(socket.conn)) {
    console.error("socket is not connected");
    return;
  }

  socket.conn.value.emit("new-game");
};

export const sendUpdatePlayer = (player: Player) => {
  if (Option.isNone(socket.conn)) {
    console.error("socket is not connected");
    return;
  }

  socket.conn.value.emit("update-player", { player });
};

export const sendMakePlayerHost = (player: Player) => {
  if (Option.isNone(socket.conn)) {
    console.error("socket is not connected");
    return;
  }

  socket.conn.value.emit("make-player-host", { player });
};
