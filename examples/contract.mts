import { defineContract, event, rpc } from "../src/index.mts";

function isNumber(x: unknown): x is number {
  return typeof x === "number" && !Number.isNaN(x);
}

export const contract = defineContract({
  rpcToServer: {
    add: rpc<{ a: number; b: number }, { sum: number }>({
      validateReq(raw: unknown) {
        if (typeof raw !== "object" || raw === null)
          throw new Error("invalid add req");
        const r = raw as { a?: unknown; b?: unknown };
        if (!isNumber(r.a) || !isNumber(r.b))
          throw new Error("a/b must be number");
        return { a: r.a, b: r.b };
      },
      validateRes(raw: unknown) {
        if (typeof raw !== "object" || raw === null)
          throw new Error("invalid add res");
        const r = raw as { sum?: unknown };
        if (!isNumber(r.sum)) throw new Error("sum must be number");
        return { sum: r.sum };
      },
    }),
    getUser: rpc<{ id: string }, { id: string; name: string }>(),
  },
  rpcToClient: {
    notifyClient: rpc<{ message: string }, { received: boolean }>(),
  },
  events: {
    serverLog: event<{ level: "info" | "warn" | "error"; message: string }>(),
    userJoined: event<{ id: string; name: string }>(),
  },
});

export type AppContract = typeof contract;
