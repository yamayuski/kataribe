import { contract } from "@kataribe/examples-shared";
import { createWsClient } from "@kataribe/nodejs";

const client = await createWsClient({
  url: "ws://localhost:3000",
  contract,
  handlersForServerCalls: {
    notifyClient: async ({ message }) => {
      console.log("📨 Received notification from server:", message);
      return { received: true };
    },
  },
});

console.log("🔗 Connected to WebSocket server");

// Set up event listeners
client.onEvent("serverLog", ({ level, message }) => {
  console.log(`📋 Server log [${level}]:`, message);
});

client.onEvent("userJoined", ({ id, name }) => {
  console.log(`👋 User joined: ${name} (${id})`);
});

// Test RPC calls
try {
  const result1 = await client.rpc.add({ a: 2, b: 3 });
  console.log("➕ Add result:", result1.sum);

  const result2 = await client.rpc.getUser({ id: "123" });
  console.log("👤 User result:", result2);

  // Emit an event
  client.emit.userJoined({ id: "456", name: "Alice" });
  console.log("📤 Emitted userJoined event");
} catch (error) {
  console.error("❌ RPC error:", error);
}

// Keep the client running
console.log("Client is running... Press Ctrl+C to exit");
process.on("SIGINT", () => {
  console.log("\n👋 Closing client connection");
  client.close();
  process.exit(0);
});
