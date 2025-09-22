import type { Envelope, Middleware, RuntimeOptions } from "./types.mts";

export function defaultGenerateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function nowMs(): number {
  return Date.now();
}

export function makeBaseEnvelope(
  kind: Envelope["kind"],
  version: number,
): Envelope {
  return { v: version, ts: nowMs(), kind };
}

export async function runMiddlewares(
  middlewares: Middleware[] | undefined,
  env: Envelope,
  direction: "out" | "in",
): Promise<void> {
  if (!middlewares?.length) return;
  for (const mw of middlewares) {
    const ctx = {
      direction,
      envelope: env,
      mutate(fn: (e: Envelope) => void) {
        fn(env);
      },
    };
    await mw(ctx);
  }
}

export function parseJson(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }
  return raw;
}

export function createLogger(custom?: RuntimeOptions["logger"]) {
  if (custom) return custom;
  return {
    debug: (..._a: unknown[]) => {},
    info: (...a: unknown[]) => console.log("[info]", ...a),
    warn: (...a: unknown[]) => console.warn("[warn]", ...a),
    error: (...a: unknown[]) => console.error("[error]", ...a),
  };
}
