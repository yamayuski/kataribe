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
  // biome-ignore lint/suspicious/noExplicitAny: WebSocket module typing requires any
  let wsModule: any;

  if (wsImpl) {
    wsModule = wsImpl;
  } else {
    try {
      // Use string literal to avoid TypeScript module resolution during compilation
      wsModule = await import("ws");
    } catch (error) {
      throw new Error(`Failed to import 'ws' module: ${error}`);
    }
  }

  const wss = new (wsModule.Server || wsModule.WebSocketServer)(wssOptions) as {
    on(event: "connection", cb: (socket: unknown) => void): void;
    close(): void;
  };

  const serverRuntime = createServerRuntime<C>(
    (cb) => {
      wss.on("connection", (socket: unknown) => {
        const transport = new WebSocketTransport({
          // biome-ignore lint/suspicious/noExplicitAny: WebSocket instance typing requires any
          existing: socket as any,
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
