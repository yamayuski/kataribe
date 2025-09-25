import type {
  ContractShape,
  EventHandlerMap,
  RpcToServerHandlerMap,
  RuntimeOptions,
  RuntimeServer,
  Transport,
} from "@kataribe/core";
import { createServerRuntime } from "@kataribe/core";
import { CloudflareWebSocketTransport } from "./transport.ts";

export interface CloudflareWsServerParams<C extends ContractShape> {
  contract: C;
  handlers: {
    rpcToServer?: RpcToServerHandlerMap<C>;
    events?: EventHandlerMap<C>;
  };
  runtime?: RuntimeOptions;
}

// Store the onTransport callback globally
let globalOnTransport:
  | ((transport: CloudflareWebSocketTransport) => void)
  | undefined;

export function createCloudflareWsHandler<C extends ContractShape>(
  params: CloudflareWsServerParams<C>,
): (request: Request) => Response {
  const _runtime = createServerRuntime(
    (onTransport: (transport: CloudflareWebSocketTransport) => void) => {
      // This function will be called when we create a transport
      // We'll store the callback to use it later
      globalOnTransport = onTransport;
    },
    params.contract,
    params.handlers,
    params.runtime,
  );

  return (request: Request): Response => {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected websocket", { status: 400 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    const transport = new CloudflareWebSocketTransport({
      webSocket: server,
    });

    // Get the onTransport callback and call it
    if (globalOnTransport) {
      globalOnTransport(transport);
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  };
}

// Durable Object class for session management
export class KataribeDurableObject {
  private runtime?: RuntimeServer<ContractShape>;

  // biome-ignore lint/complexity/noUselessConstructor: Required by Cloudflare Durable Objects
  constructor(_state: DurableObjectState) {
    // State parameter is required by Cloudflare but we don't use it in this example
  }

  async fetch<C extends ContractShape>(
    request: Request,
    params: CloudflareWsServerParams<C>,
  ): Promise<Response> {
    if (!this.runtime) {
      this.runtime = createServerRuntime(
        (onTransport: (transport: Transport) => void) => {
          this.handleWebSocket(request, onTransport);
        },
        params.contract,
        params.handlers,
        params.runtime,
      );
    }

    return this.handleWebSocket(request, (_transport) => {
      // Transport is handled by the runtime
    });
  }

  private handleWebSocket(
    request: Request,
    onTransport: (transport: Transport) => void,
  ): Response {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected websocket", { status: 400 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    const transport = new CloudflareWebSocketTransport({
      webSocket: server,
    });

    onTransport(transport);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
}
