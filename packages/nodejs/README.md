# @kataribe/nodejs

`@kataribe/nodejs` bundles the Kataribe runtime together with Node.js oriented
transports. It provides WebSocket client and server helpers built on top of `ws`
and also includes WebRTC DataChannel utilities for hybrid deployments.

## Highlights

- WebSocket helpers: `createWsClient` and `createWsServer`
- WebRTC transport wiring for Node-based peers
- Re-exports `@kataribe/core` contract builders and runtime APIs
- ESM-first build with CommonJS compatibility exports

## Installation

```sh
pnpm add @kataribe/nodejs
# or
npm install @kataribe/nodejs
```

## WebSocket Server Example

```ts
import { createWsServer, defineContract, rpc } from "@kataribe/nodejs";

const contract = defineContract({
    rpcToServer: {
        greet: rpc<{ name: string }, { message: string }>(),
    },
});

const server = await createWsServer({
    contract,
    handlers: {
        rpcToServer: {
            async greet({ name }) {
                return { message: `Hello, ${name}!` };
            },
        },
    },
    wssOptions: { port: 3333 },
});

console.log("Kataribe WebSocket server listening on :3333");
```

Pair the server with `createWsClient` from the same package (or
`@kataribe/browser`) to exchange typed RPC calls and fire-and-forget events.

## Development

- Build distributable bundles with `pnpm build`
- Run the Vitest suite with `pnpm test`
- Published artifacts are emitted to `dist/`
