# @kataribe/cloudflare

`@kataribe/cloudflare` brings Kataribe to Cloudflare Workers and Durable
Objects. It wraps the core runtime with adapters for Cloudflare's WebSocket
upgrade flow so you can run typed RPC APIs at the edge.

## Highlights

- `createCloudflareWsHandler` for Worker WebSocket endpoints
- Durable Object helper `KataribeDurableObject` for sticky sessions
- Ships TypeScript declarations for the Workers runtime
- Re-exports `@kataribe/core` contract and runtime utilities

## Installation

```sh
pnpm add @kataribe/cloudflare
# or
npm install @kataribe/cloudflare
```

## Worker Example

```ts
import {
    createCloudflareWsHandler,
    defineContract,
    rpc,
} from "@kataribe/cloudflare";

const contract = defineContract({
    rpcToServer: {
        greet: rpc<{ name: string }, { message: string }>(),
    },
});

const handler = createCloudflareWsHandler({
    contract,
    handlers: {
        rpcToServer: {
            async greet({ name }) {
                return { message: `Hello from Workers, ${name}!` };
            },
        },
    },
});

export default {
    fetch(request: Request) {
        return handler(request);
    },
};
```

For sticky sessions, wrap the same adapter inside `KataribeDurableObject` and
forward WebSocket upgrade requests to the Durable Object instance.

## Development

- Generate Worker typings and declarations with `pnpm build`
- Run the Vitest suite with `pnpm test`
- Configure Wrangler using the provided `wrangler.toml`
