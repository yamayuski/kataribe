import { createWsServer } from "@kataribe/nodejs";
import { contract } from "../contract.ts";

const server = await createWsServer({
  contract,
  wssOptions: {
    port: 3000,
    // For HTTPS/WSS, uncomment the following:
    // cert: readFileSync(join(process.cwd(), "certs/localhost.pem")),
    // key: readFileSync(join(process.cwd(), "certs/localhost-key.pem")),
  },
  handlers: {
    rpcToServer: {
      async add({ a, b }) {
        console.log(`Add request: ${a} + ${b}`);
        return { sum: a + b };
      },
      async getUser({ id }) {
        console.log(`Get user request: ${id}`);
        return { id, name: `User ${id}` };
      },
    },
  },
});

console.log("🚀 WebSocket server started on ws://localhost:3000");

server.onConnection(async (conn) => {
  console.log("New client connected");

  // Send a welcome message
  try {
    const response = await conn.callClient.notifyClient({
      message: "Welcome to the kataribe server!",
    });
    console.log("Client received notification:", response.received);
  } catch (error) {
    console.error("Failed to send notification:", error);
  }

  // Emit some events
  setInterval(() => {
    conn.transport.send({
      kind: "event",
      ch: "serverLog",
      p: {
        level: "info" as const,
        message: `Server time: ${new Date().toISOString()}`,
      },
      v: 1,
      ts: Date.now(),
    });
  }, 5000);
});
