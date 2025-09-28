# @kataribe/deno

`@kataribe/deno` adapts Kataribe for the Deno runtime. It exports WebSocket and
WebTransport helpers that plug directly into Deno Deploy or self-hosted Deno
servers while reusing the core contract DSL.

## Highlights

- WebSocket client/server adapters (`createWsClient`, `createWsServer`)
- WebTransport helpers for bidirectional streams
- Ships as a JSR module (`jsr:@kataribe/deno`) with strict TypeScript settings
- Re-exports the entire `@kataribe/core` runtime API

## Installation

```sh
deno add jsr:@kataribe/deno
```

## Quick Start

```ts
import { createWsServer, defineContract, rpc } from "jsr:@kataribe/deno";

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
                return { message: `Hello from Deno, ${name}!` };
            },
        },
    },
    port: 8081,
});
```

Pair it with `createWsClient` (or WebTransport utilities) from the same package
or any other Kataribe distribution to exchange typed envelopes.

## Development

- Format and lint with `deno task fmt` / `deno task check`
- Run transport tests via `pnpm test` or `deno task test`
- Bundle artifacts land in `dist/`
