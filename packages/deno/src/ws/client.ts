import type {
  ClientWithServerRpc,
  ContractShape,
  RpcToClientHandlerMap,
  RuntimeOptions,
} from "@kataribe/core";
import { createClientRuntime } from "@kataribe/core";
import {
  WebSocketTransport,
  type WebSocketTransportOptions,
} from "./transport.ts";

export interface WsClientParams<C extends ContractShape>
  extends WebSocketTransportOptions {
  contract: C;
  handlersForServerCalls?: RpcToClientHandlerMap<C>;
  runtime?: RuntimeOptions;
}

export async function createWsClient<C extends ContractShape>(
  params: WsClientParams<C>,
): Promise<ClientWithServerRpc<C>> {
  const transport = new WebSocketTransport(params);

  // Wait for connection if URL provided
  if (params.url && !params.existing) {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timeout"));
      }, 10000);

      const onOpen = () => {
        clearTimeout(timeout);
        params.onOpen?.();
        resolve();
      };

      const onError = (err: Event) => {
        clearTimeout(timeout);
        params.onError?.(err);
        reject(new Error("WebSocket connection failed"));
      };

      transport.onMessage(() => {}); // Initialize
      transport.updateCallbacks({ onOpen, onError });
    });
  }

  return createClientRuntime(
    transport,
    params.contract,
    params.handlersForServerCalls,
    params.runtime,
  );
}
