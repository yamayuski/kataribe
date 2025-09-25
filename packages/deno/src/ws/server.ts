import type {
  ContractShape,
  EventHandlerMap,
  RpcToServerHandlerMap,
  RuntimeOptions,
  RuntimeServer,
} from "@kataribe/core";
import { createServerRuntime } from "@kataribe/core";
import { WebSocketTransport } from "./transport.ts";

export interface WsServerParams<C extends ContractShape> {
  contract: C;
  handlers: {
    rpcToServer?: RpcToServerHandlerMap<C>;
    events?: EventHandlerMap<C>;
  };
  runtime?: RuntimeOptions;
  port: number;
  hostname?: string;
}

export async function createWsServer<C extends ContractShape>(
  params: WsServerParams<C>,
): Promise<RuntimeServer<C>> {
  const { port, hostname = "0.0.0.0" } = params;

  return createServerRuntime(
    (onTransport) => {
      Deno.serve({ port, hostname }, (req: Request) => {
        if (req.headers.get("upgrade") !== "websocket") {
          return new Response(null, { status: 501 });
        }

        const { socket, response } = Deno.upgradeWebSocket(req);
        const transport = new WebSocketTransport({ existing: socket });
        onTransport(transport);
        return response;
      });
    },
    params.contract,
    params.handlers,
    params.runtime,
  );
}
