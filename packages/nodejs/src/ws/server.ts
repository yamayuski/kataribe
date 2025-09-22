import type {
  ContractShape,
  EventHandlerMap,
  RpcToServerHandlerMap,
  RuntimeOptions,
  RuntimeServer,
} from "@kataribe/core";
import { createServerRuntime } from "@kataribe/core";
import type WebSocket from "isomorphic-ws";
import { WebSocketServer } from "ws";
import { WebSocketTransport } from "./transport.ts";

export interface WsServerParams<C extends ContractShape> {
  contract: C;
  handlers: {
    rpcToServer?: RpcToServerHandlerMap<C>;
    events?: EventHandlerMap<C>;
  };
  runtime?: RuntimeOptions;
  wssOptions: { port: number };
}

export async function createWsServer<C extends ContractShape>(
  params: WsServerParams<C>,
): Promise<RuntimeServer<C>> {
  const { contract, handlers, runtime, wssOptions } = params;

  const wss = new WebSocketServer(wssOptions);

  const serverRuntime = createServerRuntime<C>(
    (cb) => {
      wss.on("connection", (socket: unknown) => {
        const transport = new WebSocketTransport({
          existing: socket as WebSocket,
        });
        cb(transport);
      });
    },
    contract,
    handlers,
    runtime,
  );

  return {
    onConnection: serverRuntime.onConnection,
    close: () => {
      serverRuntime.close();
      wss.close();
    },
  };
}
