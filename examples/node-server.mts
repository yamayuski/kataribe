import { createWsServer } from "../src/transports/ws/server.mts";
import { contract } from "./contract.mts";

async function main() {
  const server = await createWsServer({
    contract,
    wssOptions: { port: 3000 },
    handlers: {
      rpcToServer: {
        async add(req) {
          return { sum: req.a + req.b };
        },
        async getUser(req) {
          return { id: req.id, name: `User-${req.id}` };
        },
      },
      events: {
        userJoined(payload) {
          console.log("[event userJoined]", payload);
        },
      },
    },
    runtime: {
      timeoutMs: 5000,
      middlewares: [
        ({ direction, envelope }) => {
          if (direction === "out") {
            envelope.meta = {
              ...(envelope.meta || {}),
              serverPid: process.pid,
            };
          }
        },
      ],
      logger: {
        debug: () => {},
        info: (...a) => console.log("[server info]", ...a),
        warn: (...a) => console.warn("[server warn]", ...a),
        error: (...a) => console.error("[server error]", ...a),
      },
    },
  });

  server.onConnection(async (conn) => {
    console.log("client connected");
    try {
      const r = await conn.callClient.notifyClient({
        message: "Hello from Server!",
      });
      console.log("[server->client result]", r);
    } catch (e) {
      console.error("notifyClient failed", e);
    }
  });

  console.log("Server listening ws://localhost:3000");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
