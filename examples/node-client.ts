import { createWsClient } from "../src/index.ts";
import { contract } from "./contract.ts";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ws = require("ws");

async function main() {
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
      timeoutMs: 4000,
    },
    wsImpl: ws,
  });

  const { sum } = await client.rpc.add({ a: 10, b: 8 });
  console.log("sum", sum);

  client.emit.userJoined({ id: "u2", name: "Bob" });

  setTimeout(() => {
    console.log("closing client");
    client.close();
  }, 5000);
}

main().catch(console.error);
