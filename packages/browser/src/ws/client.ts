import { createClientRuntime } from "@kataribe/core";
import type {
  ClientWithServerRpc,
  ContractShape,
  RpcToClientHandlerMap,
  RuntimeOptions,
} from "@kataribe/core";
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
      const originalOnOpen = params.onOpen;
      const originalOnError = params.onError;

      transport.onMessage(() => {}); // Initialize transport
      
      const cleanup = () => {
        transport.close();
      };

      const onOpen = () => {
        originalOnOpen?.();
        resolve();
      };

      const onError = (err: Event) => {
        originalOnError?.(err);
        cleanup();
        reject(new Error("WebSocket connection failed"));
      };

      // Override callbacks temporarily
      (transport as any).opts.onOpen = onOpen;
      (transport as any).opts.onError = onError;
    });
  }

  return createClientRuntime(
    transport,
    params.contract,
    params.handlersForServerCalls,
    params.runtime,
  );
}