import { createWsClient } from "../src/index.ts";
import { contract } from "./contract.ts";

async function run() {
  const client = await createWsClient({
    url: "ws://localhost:3000",
    contract,
    handlersForServerCalls: {
      notifyClient: async ({ message }) => {
        console.log("[Server->Client RPC] notifyClient", message);
        return { received: true };
      },
    },
    runtime: {
      timeoutMs: 3000,
      middlewares: [
        ({ direction, envelope }) => {
          if (direction === "out") {
            envelope.meta = { ...(envelope.meta || {}), auth: "client-token" };
          }
        },
      ],
    },
  });

  client.onEvent("serverLog", (payload) => {
    console.log("[serverLog event]", payload);
  });

  const { sum } = await client.rpc.add({ a: 2, b: 5 });
  console.log("add result", sum);

  const user = await client.rpc.getUser({ id: "u1" });
  console.log("getUser", user);

  client.emit.userJoined({ id: "u1", name: "Alice" });
}

run().catch(console.error);
