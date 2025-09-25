// Minimal Deno types for build compatibility
declare namespace Deno {
  export function serve(
    options: { port: number; hostname?: string; cert?: string; key?: string },
    handler: (request: Request) => Response | Promise<Response>,
  ): void;

  export function upgradeWebSocket(request: Request): {
    socket: WebSocket;
    response: Response;
  };

  export function readTextFileSync(path: string): string;
}
