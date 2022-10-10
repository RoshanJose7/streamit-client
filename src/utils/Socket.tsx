import { createContext } from "react";
import { io, Socket } from "socket.io-client";

import { HOST } from "./constants";

export const socket = io(HOST, {
  path: "/socket.io",
  transports: ["websocket"],
});

export const SocketContext = createContext<Socket | null>(socket);
