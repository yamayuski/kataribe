import type {
  ClientWithServerRpc,
  ContractShape,
  RpcToClientHandlerMap,
  RuntimeOptions,
} from "@kataribe/core";
import { createClientRuntime } from "@kataribe/core";

export interface BunWsClientParams<C extends ContractShape> {
  url: string;
  contract: C;
  handlersForServerCalls?: RpcToClientHandlerMap<C>;
  runtime?: RuntimeOptions;
  protocols?: string | string[];
}

export async function createBunWsClient<C extends ContractShape>(
  params: BunWsClientParams<C>,
): Promise<ClientWithServerRpc<C>> {
  // Note: Bun WebSocket client implementation would be different
  // For now, we'll use the standard WebSocket API
  const ws = new WebSocket(params.url, params.protocols);

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error("WebSocket connection failed"));
  });

  // Create a simple transport adapter for standard WebSocket
  const transport = {
    send(data: unknown): void {
      ws.send(typeof data === "string" ? data : JSON.stringify(data));
    },
    onMessage(cb: (data: unknown) => void): () => void {
      const handler = (event: MessageEvent) => cb(event.data);
      ws.addEventListener("message", handler);
      return () => ws.removeEventListener("message", handler);
    },
    close(code?: number, reason?: string): void {
      ws.close(code, reason);
    },
    isOpen(): boolean {
      return ws.readyState === WebSocket.OPEN;
    },
  };

  return createClientRuntime(
    transport,
    params.contract,
    params.handlersForServerCalls,
    params.runtime,
  );
}
