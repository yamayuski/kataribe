import { createWsServer } from "@kataribe/deno";
import { contract } from "../contract.ts";

const server = await createWsServer({
  contract,
  port: 3001,
  handlers: {
    rpcToServer: {
      async add({ a, b }) {
        console.log(`Add request: ${a} + ${b}`);
        return { sum: a + b };
      },
      async getUser({ id }) {
        console.log(`Get user request: ${id}`);
        return { id, name: `Deno User ${id}` };
      },
    },
  },
});

console.log("🦕 Deno WebSocket server started on ws://localhost:3001");

server.onConnection(async (conn) => {
  console.log("New client connected to Deno server");

  try {
    const response = await conn.callClient.notifyClient({ 
      message: "Welcome to the Deno kataribe server!" 
    });
    console.log("Client received notification:", response.received);
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
});