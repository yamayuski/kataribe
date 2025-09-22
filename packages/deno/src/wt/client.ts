import type {
  ClientWithServerRpc,
  ContractShape,
  RpcToClientHandlerMap,
  RuntimeOptions,
} from "@kataribe/core";
import type { WebTransportTransportOptions } from "./transport.ts";

export interface WtClientParams<C extends ContractShape>
  extends WebTransportTransportOptions {
  contract: C;
  handlersForServerCalls?: RpcToClientHandlerMap<C>;
  runtime?: RuntimeOptions;
}

export async function createWtClient<C extends ContractShape>(
  _params: WtClientParams<C>,
): Promise<ClientWithServerRpc<C>> {
  // Note: WebTransport client implementation would go here
  // For now, we'll throw an error since it's not fully implemented
  throw new Error("WebTransport client not yet implemented for Deno");
}
