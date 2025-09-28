# @kataribe/browser

`@kataribe/browser` ships the browser-friendly runtime layers for Kataribe. It
bundles the core contract DSL together with WebSocket and WebRTC transports that
run inside modern browsers without additional polyfills.

## Highlights

- Zero-`any` TypeScript bindings with first-class ESM support
- WebSocket client helper via `createWsClient`
- WebRTC DataChannel helpers (`createWebRtcTransport`, signaling utilities)
- Re-exports of the core runtime (`defineContract`, `rpc`, `event`, ...)

## Installation

```sh
pnpm add @kataribe/browser
# or
npm install @kataribe/browser
```

## WebSocket Quick Start

```ts
import { createWsClient, defineContract, event, rpc } from "@kataribe/browser";

const contract = defineContract({
    rpcToServer: {
        greet: rpc<{ name: string }, { message: string }>(),
    },
    rpcToClient: {
        ping: rpc<void, void>(),
    },
    events: {
        metrics: event<{ latencyMs: number }>(),
    },
});

const client = await createWsClient({
    url: "wss://example.com/ws",
    contract,
    handlersForServerCalls: {
        ping: async () => {
            console.log("received ping from server");
        },
    },
});

const { message } = await client.rpc.greet({ name: "Ada" });
client.emit.metrics({ latencyMs: 12 });
```

## WebRTC Data Channels

For peer-to-peer scenarios, this package exposes helpers under `./webrtc/` for
negotiating DataChannel transports. Pair them with your signalling layer to
build low-latency RTC flows while reusing the same contract.

## Development

- Build distributable artifacts with `pnpm build`
- Run the Vitest browser test harness with `pnpm test`
- Output is written to `dist/`
