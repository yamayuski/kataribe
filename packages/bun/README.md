# @kataribe/bun

`@kataribe/bun` delivers Kataribe transports tailored for the Bun runtime. It
complements the core package with Bun-native WebSocket adapters so you can run
typed RPC servers and clients on Bun without custom glue code.

## Highlights

- Bun WebSocket server helper `createBunWsServer`
- WebSocket client bootstrapper `createBunWsClient`
- Shared runtime exports from `@kataribe/core`
- Bundled with Bun build tooling for minimal startup cost

## Installation

```sh
bun add @kataribe/bun
# or
pnpm add @kataribe/bun
```

## Example

```ts
import { createBunWsServer, defineContract, rpc } from "@kataribe/bun";

const contract = defineContract({
    rpcToServer: {
        greet: rpc<{ name: string }, { message: string }>(),
    },
});

await createBunWsServer({
    contract,
    handlers: {
        rpcToServer: {
            async greet({ name }) {
                return { message: `Hi from Bun, ${name}!` };
            },
        },
    },
    port: 8080,
});
```

Use `createBunWsClient` (or any other Kataribe client) to connect and exchange
typed RPC calls.

## Development

- Build with `pnpm build`
- Run Bun test suites with `pnpm test` (delegates to `bun test`)
- Emitted assets live in `dist/`
