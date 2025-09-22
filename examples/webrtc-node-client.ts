// Note: This is primarily intended for demonstration.
// WebRTC is mainly used in browser environments.
// For Node.js, you would need a WebRTC implementation like 'wrtc' package.

async function main() {
  console.log("WebRTC Node.js Client Example");
  console.log("Note: WebRTC is primarily for browser P2P connections.");
  console.log("For Node.js WebRTC, you would need the 'wrtc' package:");
  console.log("  npm install wrtc");
  console.log("");
  console.log("Example usage in browser:");
  console.log("1. Start the signaling server: npm run dev:webrtc-signaling");
  console.log("2. Open examples/webrtc-peer.html in two browser tabs");
  console.log("3. Click 'Connect as Initiator' in one tab");
  console.log("4. Click 'Wait for Connection' in the other tab");
  console.log("5. Test RPC calls and events between the peers");

  // For actual implementation in Node.js, you would do:
  /*
  const wrtc = require('wrtc');
  global.RTCPeerConnection = wrtc.RTCPeerConnection;
  global.RTCSessionDescription = wrtc.RTCSessionDescription;
  global.RTCIceCandidate = wrtc.RTCIceCandidate;

  const client = await createWebRTCClient({
    contract,
    signalingUrl: 'ws://localhost:3001',
    isInitiator: false,
    handlersForServerCalls: {
      notifyClient: async ({ message }) => {
        console.log('Received notification:', message);
        return { received: true };
      }
    }
  });

  console.log("Connected! Testing RPC...");
  const result = await client.rpc.add({ a: 5, b: 3 });
  console.log("Add result:", result);
  */
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
