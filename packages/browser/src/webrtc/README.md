# WebRTC DataChannel Transport

This directory contains the WebRTC DataChannel transport implementation for Kataribe, enabling browser-to-browser P2P communication.

## Features

- **P2P Communication**: Direct browser-to-browser data channels using WebRTC
- **Signaling Server**: WebSocket-based signaling for peer connection establishment
- **Type Safety**: Full TypeScript support with the same Transport interface
- **Same API**: Uses the same contract DSL and runtime as WebSocket transport

## Architecture

```
Browser A <---> Signaling Server <---> Browser B
    |                                      |
    +--- WebRTC DataChannel P2P Connection -+
```

1. **Signaling Phase**: Browsers connect to WebSocket signaling server to exchange offers, answers, and ICE candidates
2. **P2P Establishment**: WebRTC peer connection is established directly between browsers
3. **Data Communication**: All Kataribe RPC and events flow through the DataChannel

## Files

- `transport.ts` - WebRTC DataChannel transport implementation
- `client.ts` - Client-side WebRTC connection setup with signaling
- `signaling.ts` - WebSocket signaling server for coordinating connections

## Usage

### 1. Start Signaling Server

```bash
npm run dev:webrtc-signaling
```

### 2. Browser Implementation

```typescript
import { createWebRTCClient, defineContract, rpc } from 'kataribe';

const contract = defineContract({
  rpcToServer: {
    add: rpc<{ a: number; b: number }, { sum: number }>()
  }
});

// Peer 1 (initiator)
const client1 = await createWebRTCClient({
  contract,
  signalingUrl: 'ws://localhost:3001',
  isInitiator: true
});

// Peer 2 (responder)  
const client2 = await createWebRTCClient({
  contract,
  signalingUrl: 'ws://localhost:3001',
  isInitiator: false,
  handlersForServerCalls: {
    // Handle RPCs from other peer
  }
});

// Now peers can communicate directly
const result = await client1.rpc.add({ a: 5, b: 3 });
```

### 3. HTML Example

Open `examples/webrtc-peer.html` in two browser tabs to test P2P functionality.

## Configuration

### createWebRTCClient Options

- `signalingUrl` - WebSocket URL for signaling server
- `isInitiator` - Whether this peer initiates the connection
- `rtcConfiguration` - ICE servers and other RTCPeerConnection config
- `dataChannelOptions` - DataChannel configuration
- `targetPeerId` - Optional specific peer ID to connect to

### Signaling Server Options

- `port` - Port for WebSocket signaling server
- `wsImpl` - Optional WebSocket implementation override

## Browser Compatibility

Requires modern browsers with WebRTC support:
- Chrome 23+
- Firefox 22+
- Safari 11+
- Edge 79+

## ICE Servers

Default configuration includes Google STUN servers. For production use, consider:
- Adding TURN servers for NAT traversal
- Using your own STUN servers
- Configuring firewall-friendly options

## Limitations

- Requires signaling server for initial handshake
- Limited to browser environments (Node.js requires 'wrtc' package)
- Connection establishment can take several seconds
- Firewall/NAT may require TURN servers