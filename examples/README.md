# Kataribe Examples

This directory contains examples demonstrating kataribe usage across different runtime environments.

## 🏗️ Setup

1. Generate SSL certificates for secure connections:
```bash
# Install mkcert if not already installed
# See: https://github.com/FiloSottile/mkcert#installation

# Generate certificates in project root
mkcert -cert-file certs/localhost.pem -key-file certs/localhost-key.pem localhost 127.0.0.1 ::1
```

2. Build the packages:
```bash
npm run build
```

## 📁 Examples Structure

### Core Examples
- **`contract.ts`** - Shared contract definition used by all examples

### Runtime-Specific Servers
Each runtime has its own WebSocket server implementation:

| Runtime | Directory | Port | Command |
|---------|-----------|------|---------|
| Node.js | `nodejs-ws/` | 3000 | `npm run dev:server` |
| Deno | `deno-ws/` | 3001 | `deno run --allow-net examples/deno-ws/server.ts` |
| Bun | `bun-ws/` | 3002 | `bun examples/bun-ws/server.ts` |
| Cloudflare | `cloudflare-ws/` | 8787 | `wrangler dev` |

### Browser Client
- **`browser-client/index.html`** - Universal browser client that can connect to any server
  - Radio button interface to select which runtime to connect to
  - Real-time RPC testing
  - Event logging
  - WebSocket connection management

## 🚀 Quick Start

1. **Start a server** (pick one):
   ```bash
   # Node.js
   npm run dev:server
   
   # Deno  
   deno run --allow-net examples/deno-ws/server.ts
   
   # Bun
   bun examples/bun-ws/server.ts
   ```

2. **Test with Node.js client**:
   ```bash
   npm run dev:client
   ```

3. **Test with browser client**:
   - Open `examples/browser-client/index.html` in your browser
   - Select the corresponding runtime
   - Click "Connect" and test the RPC calls

## 🔧 Development

### Adding New Transports
Each runtime package supports different transports:

- **Node.js**: WebSocket, WebRTC DataChannel
- **Browser**: WebSocket, WebRTC DataChannel, WebTransport (future)
- **Deno**: WebSocket, WebRTC DataChannel, WebTransport (experimental)
- **Cloudflare**: WebSocket, WebRTC DataChannel (via Durable Objects)
- **Bun**: WebSocket, WebRTC DataChannel

### Testing Matrix
Use the browser client to test all runtime combinations:
1. Start multiple servers on different ports
2. Open browser client
3. Switch between runtimes using radio buttons
4. Verify all RPC calls and events work consistently

## 📋 Features Demonstrated

- ✅ Bidirectional RPC calls (`rpcToServer`, `rpcToClient`)
- ✅ Fire-and-forget events
- ✅ Type-safe contract definitions
- ✅ Runtime validation (optional)
- ✅ Error handling
- ✅ Connection management
- ✅ Cross-runtime compatibility

## 🔍 Architecture

Each example follows the same pattern:
1. Import the appropriate `@kataribe/{runtime}` package
2. Use the shared `contract.ts` definition
3. Implement the same RPC handlers
4. Set up connection handling
5. Demonstrate bidirectional communication

This shows how kataribe provides a consistent API across all JavaScript runtime environments.