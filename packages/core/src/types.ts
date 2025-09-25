export interface Envelope {
  v: number;
  ts: number;
  id?: string;
  kind: "rpc_req" | "rpc_res" | "rpc_err" | "event" | "hello";
  ch?: string;
  p?: unknown;
  m?: string;
  code?: string;
  meta?: Record<string, unknown>;
  feat?: string[];
}

export interface Transport {
  send(data: unknown): void | Promise<void>;
  onMessage(cb: (data: unknown) => void): () => void;
  close(code?: number, reason?: string): void;
  isOpen(): boolean;
}

export interface MiddlewareContext {
  direction: "out" | "in";
  envelope: Envelope;
  mutate(fn: (env: Envelope) => void): void;
}
export type Middleware = (ctx: MiddlewareContext) => void | Promise<void>;

export interface RuntimeOptions {
  version?: number;
  timeoutMs?: number;
  generateId?: () => string;
  middlewares?: Middleware[];
  features?: string[];
  onUnknownEnvelope?: (env: Envelope) => void;
  logger?: {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
}

export interface RpcDescriptor<Req, Res> {
  kind: "rpc";
  validateReq?: (raw: unknown) => Req;
  validateRes?: (raw: unknown) => Res;
  _req?: Req;
  _res?: Res;
}

export interface EventDescriptor<Payload> {
  kind: "event";
  validate?: (raw: unknown) => Payload;
  _payload?: Payload;
}

export function rpc<Req, Res>(opts?: {
  validateReq?: (raw: unknown) => Req;
  validateRes?: (raw: unknown) => Res;
}): RpcDescriptor<Req, Res> {
  return { kind: "rpc", ...(opts ?? {}) };
}

export function event<Payload>(opts?: {
  validate?: (raw: unknown) => Payload;
}): EventDescriptor<Payload> {
  return { kind: "event", ...(opts ?? {}) };
}

export interface ContractShape {
  rpcToServer?: Record<string, RpcDescriptor<unknown, unknown>>;
  rpcToClient?: Record<string, RpcDescriptor<unknown, unknown>>;
  events?: Record<string, EventDescriptor<unknown>>;
}

export function defineContract<const C extends ContractShape>(c: C): C {
  return c;
}

export type ExtractReq<D> = D extends RpcDescriptor<infer A, unknown>
  ? A
  : never;
export type ExtractRes<D> = D extends RpcDescriptor<unknown, infer B>
  ? B
  : never;
export type ExtractEventPayload<D> = D extends EventDescriptor<infer P>
  ? P
  : never;

export type RpcToServerMethods<C extends ContractShape> =
  C["rpcToServer"] extends Record<string, RpcDescriptor<unknown, unknown>>
    ? {
        [K in keyof C["rpcToServer"]]: (
          req: ExtractReq<C["rpcToServer"][K]>,
        ) => Promise<ExtractRes<C["rpcToServer"][K]>>;
      }
    : never;

export type RpcToClientMethods<C extends ContractShape> =
  C["rpcToClient"] extends Record<string, RpcDescriptor<unknown, unknown>>
    ? {
        [K in keyof C["rpcToClient"]]: (
          req: ExtractReq<C["rpcToClient"][K]>,
        ) => Promise<ExtractRes<C["rpcToClient"][K]>>;
      }
    : never;

export type EventEmitters<C extends ContractShape> = C["events"] extends Record<
  string,
  EventDescriptor<unknown>
>
  ? {
      [K in keyof C["events"]]: (
        payload: ExtractEventPayload<C["events"][K]>,
      ) => void;
    }
  : never;

export type RpcToServerHandlerMap<C extends ContractShape> =
  C["rpcToServer"] extends Record<string, RpcDescriptor<unknown, unknown>>
    ? {
        [K in keyof C["rpcToServer"]]: (
          req: ExtractReq<C["rpcToServer"][K]>,
          meta: Envelope,
        ) => Promise<ExtractRes<C["rpcToServer"][K]>>;
      }
    : never;

export type RpcToClientHandlerMap<C extends ContractShape> =
  C["rpcToClient"] extends Record<string, RpcDescriptor<unknown, unknown>>
    ? {
        [K in keyof C["rpcToClient"]]: (
          req: ExtractReq<C["rpcToClient"][K]>,
          meta: Envelope,
        ) => Promise<ExtractRes<C["rpcToClient"][K]>>;
      }
    : never;

export type EventHandlerMap<C extends ContractShape> =
  C["events"] extends Record<string, EventDescriptor<unknown>>
    ? {
        [K in keyof C["events"]]?: (
          payload: ExtractEventPayload<C["events"][K]>,
          meta: Envelope,
        ) => void | Promise<void>;
      }
    : never;

export interface RuntimeClient<C extends ContractShape> {
  rpc: RpcToServerMethods<C>;
  emit: EventEmitters<C>;
  close(): void;
  transport: Transport;
  onEvent: <K extends keyof EventHandlerMap<C> & string>(
    name: K,
    handler: NonNullable<EventHandlerMap<C>[K]>,
  ) => () => void;
}

export interface ClientWithServerRpc<C extends ContractShape>
  extends RuntimeClient<C> {
  handlersForServerCalls: RpcToClientHandlerMap<C>;
}

export interface ServerConnection<C extends ContractShape> {
  transport: Transport;
  callClient: RpcToClientMethods<C>;
  close(): void;
}

export interface RuntimeServer<C extends ContractShape> {
  onConnection(cb: (conn: ServerConnection<C>) => void): void;
  close(): void;
}
