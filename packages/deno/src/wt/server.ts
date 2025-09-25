import type {
  ContractShape,
  EventHandlerMap,
  RpcToServerHandlerMap,
  RuntimeOptions,
  RuntimeServer,
} from "@kataribe/core";
import { createServerRuntime } from "@kataribe/core";

export interface WtServerParams<C extends ContractShape> {
  contract: C;
  handlers: {
    rpcToServer?: RpcToServerHandlerMap<C>;
    events?: EventHandlerMap<C>;
  };
  runtime?: RuntimeOptions;
  port: number;
  hostname?: string;
  certFile?: string;
  keyFile?: string;
}

export async function createWtServer<C extends ContractShape>(
  params: WtServerParams<C>,
): Promise<RuntimeServer<C>> {
  const { port, hostname = "0.0.0.0", certFile, keyFile } = params;

  if (!certFile || !keyFile) {
    throw new Error(
      "WebTransport requires TLS certificates (certFile and keyFile)",
    );
  }

  return createServerRuntime(
    (_onTransport) => {
      // Note: This would use Deno's unstable WebTransport API
      // For now, this is a placeholder implementation
      Deno.serve(
        {
          port,
          hostname,
          cert: Deno.readTextFileSync(certFile),
          key: Deno.readTextFileSync(keyFile),
        },
        async (_req: Request) => {
          // WebTransport handshake would go here
          // This is a simplified placeholder
          throw new Error(
            "WebTransport server not yet fully implemented for Deno",
          );
        },
      );
    },
    params.contract,
    params.handlers,
    params.runtime,
  );
}
