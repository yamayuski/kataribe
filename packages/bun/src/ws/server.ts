import type {
  ContractShape,
  EventHandlerMap,
  RpcToServerHandlerMap,
  RuntimeOptions,
  RuntimeServer,
} from "@kataribe/core";
import { createServerRuntime } from "@kataribe/core";
import { BunWebSocketTransport } from "./transport.ts";

export interface BunWsServerParams<C extends ContractShape> {
  contract: C;
  handlers: {
    rpcToServer?: RpcToServerHandlerMap<C>;
    events?: EventHandlerMap<C>;
  };
  runtime?: RuntimeOptions;
  port?: number;
  hostname?: string;
}

// Store the onTransport callback globally
let globalOnTransport: ((transport: BunWebSocketTransport) => void) | undefined;

export async function createBunWsServer<C extends ContractShape>(
  params: BunWsServerParams<C>,
): Promise<RuntimeServer<C>> {
  const { port = 3000, hostname = "0.0.0.0" } = params;
  const connections = new Map<
    import("bun").ServerWebSocket,
    BunWebSocketTransport
  >();

  const runtime = createServerRuntime(
    (onTransport) => {
      // Store the callback to use it when connections are established
      globalOnTransport = onTransport;
    },
    params.contract,
    params.handlers,
    params.runtime,
  );

  const _server = Bun.serve({
    port,
    hostname,
    websocket: {
      open(ws) {
        const transport = new BunWebSocketTransport({ ws });
        connections.set(ws, transport);

        // Get the onTransport callback and call it
        if (globalOnTransport) {
          globalOnTransport(transport);
        }
      },
      message(ws, message) {
        const transport = connections.get(ws);
        if (transport) {
          transport._dispatchMessage(message);
        }
      },
      close(ws, code, reason) {
        const transport = connections.get(ws);
        if (transport) {
          transport._handleClose(code, reason);
          connections.delete(ws);
        }
      },
      error(ws, error) {
        const transport = connections.get(ws);
        if (transport) {
          transport._handleError(error);
        }
      },
    },
    fetch(req, server) {
      const _url = new URL(req.url);

      if (server.upgrade(req)) {
        return; // WebSocket upgrade successful
      }

      return new Response("Expected WebSocket connection", { status: 400 });
    },
  });

  return runtime;
}
