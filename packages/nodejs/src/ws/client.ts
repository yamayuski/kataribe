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
  const { contract, handlersForServerCalls, runtime, ...wsOpts } = params;
  const transport = new WebSocketTransport(wsOpts);
  if (!transport.isOpen()) {
    await new Promise<void>((resolve) => {
      const loop = () => {
        if (transport.isOpen()) resolve();
        else setTimeout(loop, 15);
      };
      loop();
    });
  }
  return createClientRuntime(
    transport,
    contract,
    handlersForServerCalls ?? ({} as RpcToClientHandlerMap<C>),
    runtime,
  );
}
