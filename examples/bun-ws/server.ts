import { createBunWsServer } from "@kataribe/bun";
import { contract } from "../contract.ts";

const server = await createBunWsServer({
  contract,
  port: 3002,
  handlers: {
    rpcToServer: {
      async add({ a, b }) {
        console.log(`Add request: ${a} + ${b}`);
        return { sum: a + b };
      },
      async getUser({ id }) {
        console.log(`Get user request: ${id}`);
        return { id, name: `Bun User ${id}` };
      },
    },
  },
});

console.log("🍞 Bun WebSocket server started on ws://localhost:3002");

server.onConnection(async (conn) => {
  console.log("New client connected to Bun server");

  try {
    const response = await conn.callClient.notifyClient({ 
      message: "Welcome to the Bun kataribe server!" 
    });
    console.log("Client received notification:", response.received);
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
});