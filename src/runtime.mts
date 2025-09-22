import type {
  ClientWithServerRpc,
  ContractShape,
  Envelope,
  EventDescriptor,
  EventEmitters,
  EventHandlerMap,
  RpcDescriptor,
  RpcToClientHandlerMap,
  RpcToClientMethods,
  RpcToServerHandlerMap,
  RpcToServerMethods,
  RuntimeOptions,
  ServerConnection,
  Transport,
} from "./types.mts";
import {
  createLogger,
  defaultGenerateId,
  makeBaseEnvelope,
  parseJson,
  runMiddlewares,
} from "./utils.mts";

interface PendingEntry {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timer?: unknown;
}

function buildRpcCaller(
  methodMap: Record<string, RpcDescriptor<unknown, unknown>>,
  sendEnvelope: (env: Envelope) => void | Promise<void>,
  middlewares:
    | ((ctx: {
        direction: "out" | "in";
        envelope: Envelope;
        mutate(fn: (e: Envelope) => void): void;
      }) => void | Promise<void>)[]
    | undefined,
  version: number,
  options: RuntimeOptions,
  genId: () => string,
  pending: Map<string, PendingEntry>,
): Record<string, (req: unknown) => Promise<unknown>> {
  const result: Record<string, (req: unknown) => Promise<unknown>> = {};
  const keys = Object.keys(methodMap);
  for (const method of keys) {
    const descriptor = methodMap[method];
    result[method] = (req: unknown) => {
      const id = genId();
      const env: Envelope = {
        ...makeBaseEnvelope("rpc_req", version),
        id,
        ch: method,
        p: descriptor.validateReq ? descriptor.validateReq(req) : req,
      };
      const promise = new Promise<unknown>((resolve, reject) => {
        const timer = options.timeoutMs
          ? setTimeout(() => {
              pending.delete(id);
              reject(new Error(`RPC Timeout: ${method}`));
            }, options.timeoutMs)
          : undefined;
        pending.set(id, { resolve, reject, timer });
      });
      runMiddlewares?.(middlewares, env, "out")
        .then(() => sendEnvelope(env))
        .catch((err) => {
          const p = pending.get(id);
          if (p) {
            p.reject(err);
            pending.delete(id);
          }
        });
      return promise.then((res) =>
        descriptor.validateRes ? descriptor.validateRes(res) : res,
      );
    };
  }
  return result;
}

export function createClientRuntime<C extends ContractShape>(
  transport: Transport,
  contract: C,
  handlersForServerCalls: RpcToClientHandlerMap<C> = {} as RpcToClientHandlerMap<C>,
  options: RuntimeOptions = {},
): ClientWithServerRpc<C> {
  const version = options.version ?? 1;
  const genId = options.generateId ?? defaultGenerateId;
  const middlewares = options.middlewares;
  const logger = createLogger(options.logger);

  const pending = new Map<string, PendingEntry>();
  const eventHandlers = new Map<
    string,
    Set<(payload: unknown, meta: Envelope) => void | Promise<void>>
  >();

  function sendEnvelope(env: Envelope): void | Promise<void> {
    return transport.send(env);
  }

  // hello
  sendEnvelope({
    ...makeBaseEnvelope("hello", version),
    feat: options.features,
  });

  transport.onMessage(async (raw) => {
    const parsed = parseJson(raw);
    if (typeof parsed !== "object" || parsed === null) return;
    const env = parsed as Envelope;

    await runMiddlewares(middlewares, env, "in");

    switch (env.kind) {
      case "rpc_res":
      case "rpc_err": {
        if (!env.id) return;
        const entry = pending.get(env.id);
        if (!entry) return;
        if (env.kind === "rpc_res") entry.resolve(env.p);
        else entry.reject(new Error(env.m ?? "RPC Error"));
        if (entry.timer) {
          clearTimeout(entry.timer as unknown as number);
        }
        pending.delete(env.id);
        break;
      }
      case "rpc_req": {
        // server -> client
        const method = env.ch;
        if (!method) return;
        const rpcDefs = contract.rpcToClient ?? {};
        const descriptor = rpcDefs[method];
        const impl =
          handlersForServerCalls[method as keyof typeof handlersForServerCalls];
        if (!descriptor || !impl) {
          const errEnv: Envelope = {
            ...makeBaseEnvelope("rpc_err", version),
            id: env.id,
            ch: method,
            m: `Client method not found: ${method}`,
            code: "NOT_FOUND",
          };
          await runMiddlewares(middlewares, errEnv, "out");
          transport.send(errEnv);
          return;
        }
        try {
          const reqPayload = descriptor.validateReq
            ? descriptor.validateReq(env.p)
            : env.p;
          const res = await impl(reqPayload, env);
          const resPayload = descriptor.validateRes
            ? descriptor.validateRes(res)
            : res;
          const resEnv: Envelope = {
            ...makeBaseEnvelope("rpc_res", version),
            id: env.id,
            ch: method,
            p: resPayload,
          };
          await runMiddlewares(middlewares, resEnv, "out");
          transport.send(resEnv);
        } catch (e) {
          const errEnv: Envelope = {
            ...makeBaseEnvelope("rpc_err", version),
            id: env.id,
            ch: method,
            m: e instanceof Error ? e.message : "RPC Error",
          };
          await runMiddlewares(middlewares, errEnv, "out");
          transport.send(errEnv);
        }
        break;
      }
      case "event": {
        if (!env.ch) return;
        const handlersSet = eventHandlers.get(env.ch);
        if (!handlersSet) return;
        for (const h of handlersSet) {
          try {
            await h(env.p, env);
          } catch (e) {
            logger.error("event handler error", e);
          }
        }
        break;
      }
      case "hello":
        logger.debug("hello (server->client)", env.feat);
        break;
      default:
        options.onUnknownEnvelope?.(env);
    }
  });

  function buildRpcToServer(): RpcToServerMethods<C> {
    const map = contract.rpcToServer ?? {};
    return buildRpcCaller(
      map,
      sendEnvelope,
      middlewares,
      version,
      options,
      genId,
      pending,
    ) as RpcToServerMethods<C>;
  }

  function buildEmitters(): EventEmitters<C> {
    const def = contract.events ?? {};
    const result: Record<string, (payload: unknown) => void> = {};
    const keys = Object.keys(def) as (keyof typeof def)[];
    keys.forEach((name) => {
      const descriptor = def[name] as EventDescriptor<unknown>;
      result[name as string] = (payload: unknown) => {
        const validated = descriptor.validate
          ? descriptor.validate(payload)
          : payload;
        const env: Envelope = {
          ...makeBaseEnvelope("event", version),
          ch: name as string,
          p: validated,
        };
        runMiddlewares(middlewares, env, "out")
          .then(() => sendEnvelope(env))
          .catch((e) => logger.error("emit error", e));
      };
    });
    return result as EventEmitters<C>;
  }

  function onEvent(
    name: string,
    handler: (payload: unknown, meta: Envelope) => void | Promise<void>,
  ) {
    let set = eventHandlers.get(name);
    if (!set) {
      set = new Set();
      eventHandlers.set(name, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }

  function close() {
    transport.close();
    for (const p of pending.values()) {
      p.reject(new Error("client runtime closed"));
      if (p.timer) {
        clearTimeout(p.timer as unknown as number);
      }
    }
    pending.clear();
  }

  return {
    rpc: buildRpcToServer(),
    emit: buildEmitters(),
    close,
    transport,
    onEvent: onEvent as ClientWithServerRpc<C>["onEvent"],
    handlersForServerCalls,
  };
}

export function createServerConnection<C extends ContractShape>(
  transport: Transport,
  contract: C,
  options: RuntimeOptions,
  _handlersRpcToServer: RpcToServerHandlerMap<C>,
  middlewares: RuntimeOptions["middlewares"],
  genId: () => string,
  pending: Map<string, PendingEntry>,
): ServerConnection<C> {
  const version = options.version ?? 1;
  const rpcToClientDefs = contract.rpcToClient ?? {};
  const callClient = buildRpcCaller(
    rpcToClientDefs,
    (env) => transport.send(env),
    middlewares,
    version,
    options,
    genId,
    pending,
  ) as RpcToClientMethods<C>;

  return {
    transport,
    callClient,
    close: () => transport.close(),
  };
}

export function createServerRuntime<C extends ContractShape>(
  makeTransport: (cb: (t: Transport) => void) => void,
  contract: C,
  handlers: {
    rpcToServer?: RpcToServerHandlerMap<C>;
    events?: EventHandlerMap<C>;
  },
  options: RuntimeOptions = {},
) {
  const version = options.version ?? 1;
  const middlewares = options.middlewares;
  const logger = createLogger(options.logger);
  const conns = new Set<ServerConnection<C>>();

  function attachTransport(transport: Transport) {
    const genId = options.generateId ?? defaultGenerateId;
    const pending = new Map<string, PendingEntry>();

    transport.send({
      ...makeBaseEnvelope("hello", version),
      feat: options.features,
    });

    const conn = createServerConnection(
      transport,
      contract,
      options,
      handlers.rpcToServer ?? ({} as RpcToServerHandlerMap<C>),
      middlewares,
      genId,
      pending,
    );
    conns.add(conn);

    transport.onMessage(async (raw) => {
      const parsed = parseJson(raw);
      if (typeof parsed !== "object" || parsed === null) return;
      const env = parsed as Envelope;
      await runMiddlewares(middlewares, env, "in");

      switch (env.kind) {
        case "rpc_req": {
          // client -> server
          const method = env.ch;
          if (!method) return;
          const rpcDefs = contract.rpcToServer ?? {};
          const descriptor = rpcDefs[method];
          const impl =
            handlers.rpcToServer?.[method as keyof typeof handlers.rpcToServer];
          if (!descriptor || !impl) {
            const errEnv: Envelope = {
              ...makeBaseEnvelope("rpc_err", version),
              id: env.id,
              ch: method,
              m: `Method not found: ${method}`,
              code: "NOT_FOUND",
            };
            await runMiddlewares(middlewares, errEnv, "out");
            transport.send(errEnv);
            return;
          }
          try {
            const reqPayload = descriptor.validateReq
              ? descriptor.validateReq(env.p)
              : env.p;
            const result = await impl(reqPayload, env);
            const resPayload = descriptor.validateRes
              ? descriptor.validateRes(result)
              : result;
            const resEnv: Envelope = {
              ...makeBaseEnvelope("rpc_res", version),
              id: env.id,
              ch: method,
              p: resPayload,
            };
            await runMiddlewares(middlewares, resEnv, "out");
            transport.send(resEnv);
          } catch (e) {
            const errEnv: Envelope = {
              ...makeBaseEnvelope("rpc_err", version),
              id: env.id,
              ch: method,
              m: e instanceof Error ? e.message : "RPC Error",
            };
            await runMiddlewares(middlewares, errEnv, "out");
            transport.send(errEnv);
          }
          break;
        }
        case "rpc_res":
        case "rpc_err": {
          if (!env.id) return;
          const p = pending.get(env.id);
          if (!p) return;
          if (env.kind === "rpc_res") p.resolve(env.p);
          else p.reject(new Error(env.m ?? "RPC Error"));
          if (p.timer) {
            clearTimeout(p.timer as unknown as number);
          }
          pending.delete(env.id);
          break;
        }
        case "event": {
          const name = env.ch;
          if (!name) return;
          const handler =
            handlers.events?.[name as keyof typeof handlers.events];
          if (!handler) return;
          try {
            await handler(env.p, env);
          } catch (e) {
            logger.error("event handler error", e);
          }
          break;
        }
        case "hello":
          logger.debug("client hello", env.feat);
          break;
        default:
          options.onUnknownEnvelope?.(env);
      }
    });

    return conn;
  }

  const connectionCallbacks = new Set<(conn: ServerConnection<C>) => void>();

  makeTransport((t) => {
    const conn = attachTransport(t);
    for (const cb of connectionCallbacks) {
      cb(conn);
    }
  });

  return {
    onConnection(cb: (conn: ServerConnection<C>) => void) {
      connectionCallbacks.add(cb);
    },
    close() {
      for (const c of conns) {
        c.close();
      }
      conns.clear();
    },
  };
}
