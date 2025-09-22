import type {
  ContractShape,
  EventHandlerMap,
  RpcToServerHandlerMap,
  RuntimeOptions,
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

export function createCloudflareWsHandler<C extends ContractShape>(
  params: CloudflareWsServerParams<C>,
): (request: Request) => Response {
  const _runtime = createServerRuntime(
    (onTransport) => {
      // This function will be called when we create a transport
      // We'll store the callback to use it later
      (createCloudflareWsHandler as any)._onTransport = onTransport;
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
    const onTransport = (createCloudflareWsHandler as any)._onTransport;
    if (onTransport) {
      onTransport(transport);
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  };
}

// Durable Object class for session management
export class KataribeDurableObject {
  private runtime?: any;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch<C extends ContractShape>(
    request: Request,
    params: CloudflareWsServerParams<C>,
  ): Promise<Response> {
    if (!this.runtime) {
      this.runtime = createServerRuntime(
        (onTransport) => {
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
    onTransport: (transport: any) => void,
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
