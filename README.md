# Kataribe

Kataribe is transport-and-runtime-agnostic TypeScript packages for bidirectional
(client ↔ server) RPC + fire-and-forget events over WebSocket with a type-safe,
`unknown`-only core envelope abstraction (no `any`).

## Features

- Client→Server RPC (`rpcToServer`) and Server→Client RPC (`rpcToClient`) using
  a single envelope protocol.
- Fire-and-forget events.
- Contract DSL with optional runtime validators (custom functions or Standard
  Schema).
- Middleware (in/out) for auth, tracing, compression hooks.
- No `any` in source; strict generics.
- Biome for lint/format/ci.

### Supported Runtimes and Transports

| Runtime            | WebSocket | WebRTC | WebTransport     |
| ------------------ | --------- | ------ | ---------------- |
| node.js 22+        | ✅        | ✅     | ✖                |
| Deno 2.5+          | ✅        | ✅     | ✅(unstable)     |
| Cloudflare Workers | ✅        | ✅     | ✖                |
| Bun                | ✅        | ✅     | ✖                |
| Browsers           | ✅        | ✅     | ✅(experimental) |

## WIP: Install (after publish)

```bash
npm install kataribe
```

## Quick Example

```ts
import {
  createWsClient,
  createWsServer,
  defineContract,
  event,
  rpc,
} from "kataribe";

const contract = defineContract({
  rpcToServer: {
    add: rpc<{ a: number; b: number }, { sum: number }>(),
  },
  rpcToClient: {
    notifyClient: rpc<{ message: string }, { received: boolean }>(),
  },
  events: {
    userJoined: event<{ id: string; name: string }>(),
  },
});

// Server
const server = await createWsServer({
  contract,
  wssOptions: { port: 3000 },
  handlers: {
    rpcToServer: {
      async add(req) {
        return { sum: req.a + req.b };
      },
    },
  },
});
server.onConnection(async (conn) => {
  await conn.callClient.notifyClient({ message: "Hello Client!" });
});

// Client
const client = await createWsClient({
  url: "ws://localhost:3000",
  contract,
  handlersForServerCalls: {
    notifyClient: async ({ message }) => ({ received: true }),
  },
});
const { sum } = await client.rpc.add({ a: 2, b: 3 });
console.log(sum);
```

## Scripts

| Script               | Description                            |
| -------------------- | -------------------------------------- |
| build                | Clean + declarations + ESM + CJS + UMD |
| check                | Biome lint+format verification         |
| dev:server           | Run example server                     |
| dev:client           | Run example node client                |
| dev:webrtc-signaling | Run WebRTC signaling server            |

## Runtime Support

### Browsers

- [WebSocket | Can I use... Support tables for HTML5, CSS3, etc](https://caniuse.com/mdn-api_websocket)
- [RTCPeerConnection.prototype.createDataChannel | Can I use... Support tables for HTML5, CSS3, etc](https://caniuse.com/mdn-api_rtcpeerconnection_createdatachannel)
- [WebTransport | Can I use... Support tables for HTML5, CSS3, etc](https://caniuse.com/webtransport)

## Development

### SSL/TLS Setup for Examples

For secure WebSocket (wss://) and HTTPS examples, generate SSL certificates
using [mkcert](https://github.com/FiloSottile/mkcert):

```bash
# Install mkcert (if not already installed)
# See: https://github.com/FiloSottile/mkcert#installation

# Generate certificates
mkcert -cert-file certs/localhost.pem -key-file certs/localhost-key.pem localhost 127.0.0.1 ::1
```

Example servers will use these certificates for secure communication.

### DevContainer

The repository includes a DevContainer configuration for a consistent
development environment:

- **Node.js 22+** (primary runtime)
- **Deno** and **Bun** (additional JavaScript runtimes)
- **Biome** VS Code extension for formatting and linting
- **Pre-configured** VS Code settings and port forwarding

To use: Open in VS Code → "Reopen in Container"

### CI

GitHub Actions: Node 24, biome ci, build. Publish step scaffolded (commented).

## Roadmap

- ~~WebRTC DataChannel transport~~ ✅ **DONE**
- Additional transports: WebTransport / HTTP/2
- Stream RPC (chunked)
- RPC cancellation (rpc_cancel)
- ~~Schema integration (zod/valibot)~~ ✅ **DONE** (Standard Schema support)
- Reconnect + session resume
- Encryption / compression middleware examples

## License

MIT
