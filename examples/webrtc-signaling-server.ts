import { createWebRTCSignalingServer } from "../src/index.ts";
import { contract } from "./contract.ts";

async function main() {
  const signalingServer = await createWebRTCSignalingServer({
    contract,
    handlers: {
      rpcToServer: {},
      events: {},
    },
    port: 3001,
  });

  console.log("WebRTC Signaling Server listening on port 3001");
  console.log(
    "Open two browser tabs to examples/webrtc-peer.html to test P2P connection",
  );

  process.on("SIGINT", () => {
    console.log("\nShutting down signaling server...");
    signalingServer.close();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
