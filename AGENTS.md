# Copilot Instructions for Kataribe

This document provides comprehensive guidance for GitHub Copilot coding agents
working on the **kataribe** repository.

## Repository Overview

**kataribe** is a TypeScript library for bidirectional (client ↔ server) RPC +
fire-and-forget events over WebSocket with type-safe, `unknown`-only core
envelope abstraction (no `any`). It's designed as an npm package library with
strict type safety and no `any` types in the source code.

### Key Features

- Client→Server RPC (`rpcToServer`) and Server→Client RPC (`rpcToClient`) using
  a single envelope protocol
- Fire-and-forget events
- Contract DSL with optional runtime validators
- Middleware (in/out) for auth, tracing, compression hooks
- Never `any` in source; strict generics and `unknown` types
- Basic WebSocket transport (browser + Node `ws`)
- Bundled outputs: ESM, CJS, UMD + type declarations

## Technology Stack

- **Language**: TypeScript (strict mode, no `any` types)
- **Runtime**: Node.js >=22
- **Package Manager**: pnpm
- **Build System**: tsdown for bundling, TypeScript compiler for declarations
- **Code Quality**: Biome for linting, formatting, and CI checks
- **Dependencies**:
  - `ws` for WebSocket implementation
  - Development tools: `@biomejs/biome`, `tsdown`, `tsx`, `typescript`

## Project Structure

```
├── src/                    # Source code
│   ├── index.ts           # Main exports
│   ├── runtime.ts         # Core runtime logic
│   ├── types.ts           # Type definitions
│   ├── utils.ts           # Utility functions
│   └── transports/        # Transport implementations
│       ├── ws/            # WebSocket transport
│       └── webrtc/        # WebRTC DataChannel transport
├── examples/              # Example implementations
│   ├── contract.ts        # Contract definition example
│   ├── node-server.ts     # Node.js server example
│   ├── node-client.ts     # Node.js client example
│   ├── browser-client.ts  # Browser client example
│   ├── webrtc-signaling-server.ts  # WebRTC signaling server
│   ├── webrtc-peer.html   # WebRTC browser P2P demo
│   └── webrtc-node-client.ts       # WebRTC Node.js example
├── dist/                  # Build outputs (generated)
└── package.json           # Package configuration
```

## Development Workflow

### Available npm Scripts

| Script                 | Description                                            | Usage                          |
| ---------------------- | ------------------------------------------------------ | ------------------------------ |
| `build`                | Complete build: clean + declarations + ESM + CJS + UMD | `npm run build`                |
| `clean`                | Clean dist directory                                   | `npm run clean`                |
| `build:types`          | Generate TypeScript declarations                       | `npm run build:types`          |
| `build:esm`            | Build ESM bundle                                       | `npm run build:esm`            |
| `build:cjs`            | Build CommonJS bundle                                  | `npm run build:cjs`            |
| `build:umd`            | Build UMD bundle                                       | `npm run build:umd`            |
| `format`               | Format code with Biome (auto-fix)                      | `npm run format`               |
| `lint`                 | Lint code with Biome                                   | `npm run lint`                 |
| `check`                | Run Biome CI checks                                    | `npm run check`                |
| `dev:server`           | Run example server                                     | `npm run dev:server`           |
| `dev:client`           | Run example node client                                | `npm run dev:client`           |
| `dev:webrtc-signaling` | Run WebRTC signaling server                            | `npm run dev:webrtc-signaling` |

### Development Process

1. **Install dependencies**: `npm install`
2. **Run checks**: `npm run check` (lint + format verification)
3. **Format code**: `npm run format` (auto-fix formatting issues)
4. **Build**: `npm run build` (full build pipeline)
5. **Test examples**: `npm run dev:server` + `npm run dev:client`

## Build System

The project uses **esbuild** for fast bundling and **TypeScript compiler** for
type declarations:

### Build Outputs (dist/)

- `index.mjs` - ESM bundle
- `index.cjs` - CommonJS bundle
- `kataribe.umd.js` - UMD bundle for browsers
- `index.d.ts` + related `.d.ts` files - Type declarations

### Build Configuration

- **Platform-neutral ESM** for maximum compatibility
- **Node.js-optimized CJS** for legacy Node environments
- **Browser-compatible UMD** with global `Kataribe` namespace
- **Source maps** generated for all bundles
- **Tree-shaking friendly** with `sideEffects: false`

## Architecture & Code Organization

### Core Concepts

1. **Envelope Protocol**: All communication uses type-safe envelope abstraction
   - Structure: `{ v, ts, id?, kind, ch?, p?, m?, code?, meta?, feat? }`
   - Types: `rpc_req`, `rpc_res`, `rpc_err`, `event`, `hello`

2. **Contract DSL**: Type-safe contract definitions
   ```typescript
   const contract = defineContract({
     rpcToServer: { methodName: rpc<Req, Res>() },
     rpcToClient: { methodName: rpc<Req, Res>() },
     events: { eventName: event<Payload>() },
   });
   ```

3. **Runtime System**: Client and server runtimes with middleware support

4. **Transport Layer**: Pluggable transport system (currently WebSocket)

### Key Files & Responsibilities

- **`src/types.ts`**: Core type definitions, no runtime code
- **`src/runtime.ts`**: Client/server runtime implementations
- **`src/utils.ts`**: Utility functions (ID generation, middleware execution,
  logging)
- **`src/index.ts`**: Public API exports
- **`src/transports/ws/`**: WebSocket transport implementation

### Type Safety Guidelines

- **NO `any` types** - Use `unknown` instead
- **Strict generics** - All type parameters must be properly constrained
- **Runtime validation** - Use optional validators in contract definitions
- **Envelope typing** - All communication typed through envelope system

## Code Style & Conventions

### Biome Configuration

The project uses Biome for consistent code style:

- **Formatting**: Automatic formatting with `npm run format`
- **Linting**: Static analysis with `npm run lint`
- **CI checks**: Combined checks with `npm run check`

### TypeScript Conventions

- Use `interface` for object shapes
- Use `type` for unions, intersections, and computed types
- Prefer `const` assertions for literal types
- Use meaningful generic parameter names (`Req`, `Res`, `Payload`)

### Import/Export Patterns

- Use explicit imports/exports
- Group imports: external modules, then internal modules
- Re-export from `index.ts` for public API

## Testing & Examples

### Example Applications

The `examples/` directory contains working implementations:

- **Contract definition** (`contract.ts`) - Shows contract DSL usage
- **Server implementation** (`node-server.ts`) - WebSocket server with RPC
  handlers
- **Node client** (`node-client.ts`) - Node.js client implementation
- **Browser client** (`browser-client.ts`) - Browser-compatible client

### Manual Testing

```bash
# Terminal 1: Start server
npm run dev:server

# Terminal 2: Run client
npm run dev:client
```

## Package.json Scripts Helper

When working on this repository, always use the provided npm scripts:

- **Before making changes**: `npm run check` to verify current state
- **During development**: `npm run format` to fix formatting
- **Before committing**: `npm run build` to ensure everything builds
- **Before pushing**: **ALWAYS run `npm run check`** to ensure no errors
- **For testing**: Use `npm run dev:server` and `npm run dev:client`

### Important: Pre-Push Validation

**CRITICAL**: Always run `npm run check` before pushing changes to ensure no
biome CI errors. This prevents CI failures and maintains code quality standards.

## CI/CD

**GitHub Actions**:

- Node.js 24 testing
- Biome CI checks (`npm run check`)
- Build verification (`npm run build`)

## Troubleshooting

### Common Issues

1. **Build failures**: Check TypeScript errors, run `npm run build:types` first
2. **Format issues**: Run `npm run format` to auto-fix
3. **Import errors**: Verify file extensions (`.ts`) and relative paths
4. **Type errors**: Ensure no `any` types, use `unknown` instead

### Development Tips

- Use `tsx` for running TypeScript directly in development
- Check `examples/` for usage patterns
- Refer to `src/types.ts` for core type definitions
- Use middleware for cross-cutting concerns (auth, logging, etc.)

## Roadmap Features

When implementing new features, consider these planned additions:

- ~~WebRTC DataChannel transport~~ ✅ **IMPLEMENTED**
- Additional transports: WebTransport / HTTP/2
- Stream RPC (chunked)
- RPC cancellation (rpc_cancel)
- Schema integration (zod/valibot)
- Reconnect + session resume
- Encryption / compression middleware examples
