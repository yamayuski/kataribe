import { createServerRuntime } from "../../runtime.ts";
import type {
  ContractShape,
  EventHandlerMap,
  RpcToServerHandlerMap,
  RuntimeOptions,
  RuntimeServer,
} from "../../types.ts";
import { WebSocketTransport } from "./transport.ts";

export interface WsServerParams<C extends ContractShape> {
  contract: C;
  handlers: {
    rpcToServer?: RpcToServerHandlerMap<C>;
    events?: EventHandlerMap<C>;
  };
  runtime?: RuntimeOptions;
  wssOptions: { port: number };
  wsImpl?: unknown;
}

export async function createWsServer<C extends ContractShape>(
  params: WsServerParams<C>,
): Promise<RuntimeServer<C>> {
  const { contract, handlers, runtime, wssOptions, wsImpl } = params;
  const wsModule = wsImpl
    ? wsImpl
    : ((await import("ws")) as {
        Server: new (opts: { port: number }) => unknown;
      });
  const wss = new wsModule.Server(wssOptions) as {
    on(event: "connection", cb: (socket: unknown) => void): void;
    close(): void;
  };

  const serverRuntime = createServerRuntime<C>(
    (cb) => {
      wss.on("connection", (socket: unknown) => {
        const transport = new WebSocketTransport({
          existing: socket as unknown,
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
