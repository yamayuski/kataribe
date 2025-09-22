# kataribe

Bidirectional (client ↔ server) RPC + fire-and-forget events over WebSocket with a type-safe, `unknown`-only core envelope abstraction (no `any`).

## Features

- Client→Server RPC (`rpcToServer`) and Server→Client RPC (`rpcToClient`) using a single envelope protocol.
- Fire-and-forget events.
- Contract DSL with optional runtime validators.
- Middleware (in/out) for auth, tracing, compression hooks.
- No `any` in source; strict generics.
- WebSocket transport (browser + Node `ws`).
- Bundled outputs: ESM, CJS, UMD + type declarations.
- Biome for lint/format/ci.

## Install (after publish)

```bash
npm install kataribe
```

## Quick Example

```ts
import { defineContract, rpc, event, createWsClient, createWsServer } from 'kataribe';

const contract = defineContract({
  rpcToServer: {
    add: rpc<{ a: number; b: number }, { sum: number }>()
  },
  rpcToClient: {
    notifyClient: rpc<{ message: string }, { received: boolean }>()
  },
  events: {
    userJoined: event<{ id: string; name: string }>()
  }
});

// Server
const server = await createWsServer({
  contract,
  wssOptions: { port: 3000 },
  handlers: {
    rpcToServer: { async add(req) { return { sum: req.a + req.b }; } }
  }
});
server.onConnection(async conn => {
  await conn.callClient.notifyClient({ message: 'Hello Client!' });
});

// Client
const client = await createWsClient({
  url: 'ws://localhost:3000',
  contract,
  handlersForServerCalls: {
    notifyClient: async ({ message }) => ({ received: true })
  }
});
const { sum } = await client.rpc.add({ a: 2, b: 3 });
console.log(sum);
```

## Scripts

| Script | Description |
|--------|-------------|
| build | Clean + declarations + ESM + CJS + UMD |
| check | Biome lint+format verification |
| dev:server | Run example server |
| dev:client | Run example node client |

## Build Outputs

```
dist/
  index.mjs
  index.cjs
  kataribe.umd.js
  index.d.ts (and related .d.ts files)
```

## CI

GitHub Actions: Node 24, biome ci, build. Publish step scaffolded (commented).

## Roadmap

- Additional transports: WebRTC / WebTransport / HTTP/2
- Stream RPC (chunked)
- RPC cancellation (rpc_cancel)
- Schema integration (zod/valibot)
- Reconnect + session resume
- Encryption / compression middleware examples

## License

MIT
