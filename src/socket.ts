import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "$lib/types";
import { Schema } from "@effect/schema";
import { config } from "dotenv";
import { Array, Effect, Option, pipe } from "effect";
import { Server, Socket } from "socket.io";

config();

const dev = process.env.NODE_ENV !== "production";
const { VITE_SOCKET_PORT = "39373" } = process.env;

const origin = dev
  ? `http://localhost:5173`
  : `https://masternein.silentecho.eu`;

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(parseInt(VITE_SOCKET_PORT), {
  cors: {
    origin,
  },
});

console.log(
  `🚀 Socket.io server is running at ${origin}, waiting for connections...`
);

const connections = new Map<
  string,
  Socket<ClientToServerEvents, ServerToClientEvents>
>();

const chars = "ACEFGHKMNPQRTXYZ234679";

const getRandomChar = () =>
  pipe(
    Math.random() * chars.length,
    Math.floor,
    (i) => chars[i],
    (str) => str.toUpperCase()
  );

const genRoom = (): string =>
  pipe(
    getRandomChar,
    Array.replicate(8),
    Array.map((fn) => fn()),
    Array.join(""),
    (roomCode) =>
      io.sockets.adapter.rooms.has(roomCode) ? genRoom() : roomCode
  );

const getHostSocket = (roomCode: string) =>
  pipe(
    [...(io.sockets.adapter.rooms.get(roomCode) || [])],
    Array.findFirst(
      (socket) => io.sockets.sockets.get(socket)?.data.host ?? false
    ),
    Option.flatMap((socket) =>
      Option.fromNullable(io.sockets.sockets.get(socket))
    )
  );

io.on("connection", (socket) => {
  const playerId = pipe(
    Schema.decodeUnknown(Schema.String.pipe(Schema.nonEmpty()))(
      socket.handshake.query.playerId
    ),
    Effect.match({
      onFailure: ({ message }) => {
        socket.emit("error", { message });
        console.error(
          `${socket.data.playerId} is not a valid player id`,
          message
        );
        socket.disconnect();
      },
      onSuccess: (playerId) => playerId,
    }),
    Effect.runSync
  );

  if (!playerId) return;

  socket.data.playerId = playerId;
  console.log("📡✔️", `${socket.data.playerId} connected`);

  if (!playerId?.length) {
    socket.emit("error", { message: "player id is required" });
    socket.disconnect();
    return;
  }

  connections.set(playerId, socket);

  socket.on("disconnect", () => {
    if (socket.data.host) {
      socket.broadcast.to(socket.data.roomCode).emit("host-disconnected");
    }

    connections.delete(playerId);
  });

  socket.on("join", ({ roomCode }) => {
    const hostSocket = getHostSocket(roomCode);

    if (Option.isSome(hostSocket)) {
      socket.join(roomCode);
      socket.emit("in-room", { roomCode });
      hostSocket.value.emit("request-state");
      socket.data.roomCode = roomCode;
    } else {
      socket.emit("error", { message: "room does not exist" });
    }
  });

  socket.on("host", ({ roomCode }) => {
    if (!roomCode.length) {
      roomCode = genRoom();
    }

    socket.data.host = true;
    socket.data.roomCode = roomCode;
    socket.join(roomCode);
    socket.emit("in-room", { roomCode });

    console.log("🕹️✔️", `${socket.data.playerId} is hosting ${roomCode}`);
  });

  socket.on("player-state", ({ rack, attempts }) => {
    const hostSocket = getHostSocket(socket.data.roomCode);

    console.log("📋", rack);
    if (Option.isSome(hostSocket)) {
      hostSocket.value.emit("player-state", { rack, attempts });
    }
  });

  socket.on("host-state", ({ rack, attempts }, started = false) => {
    socket.broadcast
      .to(socket.data.roomCode)
      .emit("host-state", { rack, attempts }, started);
  });

  socket.on("set-code", () => {
    console.log("🔄", `${socket.data.playerId} is setting the code`);
    socket.broadcast.to(socket.data.roomCode).emit("set-code");
  });

  socket.on("ended", ({ success }) => {
    socket.broadcast.to(socket.data.roomCode).emit("ended", { success });
  });

  socket.on("attempt", ({ rack }) => {
    const hostSocket = getHostSocket(socket.data.roomCode);

    if (Option.isSome(hostSocket)) {
      console.log("🎲", `${socket.data.playerId} attempting ${rack}`);
      hostSocket.value.emit("attempt", { rack });
    }
  });
});
