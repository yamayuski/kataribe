# @kataribe/core

`@kataribe/core` contains the transport-agnostic runtime, contract DSL, and
utility helpers that power every Kataribe distribution. It is responsible for
building strongly typed RPC callers, emitting fire-and-forget events,
coordinating middleware, and enforcing the shared envelope protocol.

## Highlights

- Typed contract authoring via `defineContract`, `rpc`, and `event`
- Runtime helpers for clients and servers (`createClientRuntime`,
  `createServerRuntime`)
- Envelope middleware, feature negotiation, and timeout handling
- Shared utilities for ID generation, schema validation, and logging

## Installation

```sh
pnpm add @kataribe/core
# or
npm install @kataribe/core
```

## Quick Start

```ts
import { createClientRuntime, defineContract, event, rpc } from "@kataribe/core";

const contract = defineContract({
  rpcToServer: {
    greet: rpc<{ name: string }, { message: string }>(),
  },
  events: {
    metrics: event<{ latencyMs: number }>(),
  },
});

const transport = /* implement the Transport interface */;
const client = createClientRuntime(transport, contract);

const { message } = await client.rpc.greet({ name: "Ada" });
client.emit.metrics({ latencyMs: 12 });
```

## Developing

- Build bundles with `pnpm build`
- Run the Vitest suite with `pnpm test`
- Generated artifacts live in `dist/`
