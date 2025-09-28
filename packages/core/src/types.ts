import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Canonical message envelope flowing through transports and runtime layers.
 * Every payload exchanged between peers must conform to this structure.
 */
export interface Envelope {
  /** Protocol version shared between peers. */
  v: number;
  /** Millisecond timestamp assigned when the envelope is created. */
  ts: number;
  /** Request/response correlation identifier for RPC flows. */
  id?: string;
  /** Envelope discriminator describing the semantic role of the message. */
  kind: "rpc_req" | "rpc_res" | "rpc_err" | "event" | "hello";
  /** Channel identifier such as an RPC method name or event topic. */
  ch?: string;
  /** Serialized payload body carrying RPC arguments, results, or event data. */
  p?: unknown;
  /** Human-readable message, primarily used within error envelopes. */
  m?: string;
  /** Machine-readable error code accompanying rpc_err envelopes. */
  code?: string;
  /** Arbitrary metadata propagated alongside the envelope. */
  meta?: Record<string, unknown>;
  /** Negotiated capability flags exchanged during hello handshakes. */
  feat?: string[];
}

/**
 * Minimal transport abstraction used by the runtime to exchange envelopes.
 * Implementations must guarantee reliable ordering semantics aligned with WebSocket behaviour.
 */
export interface Transport {
  /** Sends a value across the wire, optionally asynchronously. */
  send(data: unknown): void | Promise<void>;
  /** Registers a listener for inbound messages and returns an unsubscribe handle. */
  onMessage(cb: (data: unknown) => void): () => void;
  /** Closes the underlying connection signalling an optional code and reason. */
  close(code?: number, reason?: string): void;
  /** Indicates whether the transport is currently open for I/O. */
  isOpen(): boolean;
}

/**
 * Execution context handed to middleware invocations for observing or mutating envelopes.
 */
export interface MiddlewareContext {
  /** Direction of travel for the envelope currently being processed. */
  direction: "out" | "in";
  /** Mutable reference to the envelope under inspection. */
  envelope: Envelope;
  /** Utility to perform safe mutations on the envelope in-flight. */
  mutate(fn: (env: Envelope) => void): void;
}

/**
 * Middleware hook executed before sending or after receiving envelopes.
 */
export type Middleware = (ctx: MiddlewareContext) => void | Promise<void>;

export interface LoggerLike {
  /** Low-verbosity diagnostics, primarily for trace logging. */
  debug: (...args: unknown[]) => void;
  /** Informational log channel for lifecycle events. */
  info: (...args: unknown[]) => void;
  /** Warning log channel highlighting recoverable issues. */
  warn: (...args: unknown[]) => void;
  /** Error log channel capturing unrecoverable failures. */
  error: (...args: unknown[]) => void;
}

/**
 * Runtime configuration options applied when instantiating clients or servers.
 */
export interface RuntimeOptions {
  /** Protocol version to advertise inside outgoing envelopes (defaults to 1). */
  version?: number;
  /** Milliseconds to await an RPC response before rejecting with a timeout. */
  timeoutMs?: number;
  /** Custom generator for unique envelope identifiers. */
  generateId?: () => string;
  /** Ordered middleware pipeline invoked for inbound and outbound envelopes. */
  middlewares?: Middleware[];
  /** Feature flags announced during hello negotiations. */
  features?: string[];
  /** Callback executed when an envelope cannot be interpreted by the runtime. */
  onUnknownEnvelope?: (env: Envelope) => void;
  /** Optional logging surface consumed by the runtime internals. */
  logger?: LoggerLike;
}

export interface RpcDescriptorOptions<Req, Res> {
  /** Optional runtime validator/sanitizer for inbound request payloads. */
  validateReq?: (raw: unknown) => Req | Promise<Req>;
  /** Optional runtime validator/sanitizer for outbound response payloads. */
  validateRes?: (raw: unknown) => Res | Promise<Res>;
  /** Standard Schema validator applied to requests when provided. */
  schemaReq?: StandardSchemaV1<unknown, Req>;
  /** Standard Schema validator applied to responses when provided. */
  schemaRes?: StandardSchemaV1<unknown, Res>;
}

/**
 * Descriptor describing a bidirectional RPC endpoint within a contract definition.
 */
export interface RpcDescriptor<Req, Res>
  extends RpcDescriptorOptions<Req, Res> {
  /** Descriptor discriminator retained for runtime checks. */
  kind: "rpc";
  /** Phantom type anchor for request payload inference. */
  _req?: Req;
  /** Phantom type anchor for response payload inference. */
  _res?: Res;
}

/**
 * Descriptor describing an event channel within a contract definition.
 */
export interface EventDescriptorOptions<Payload> {
  /** Optional runtime validator/sanitizer for event payloads. */
  validate?: (raw: unknown) => Payload | Promise<Payload>;
  /** Optional Standard Schema validator for event payloads. */
  schema?: StandardSchemaV1<unknown, Payload>;
}

/**
 * Descriptor describing an event channel within a contract definition.
 */
export interface EventDescriptor<Payload>
  extends EventDescriptorOptions<Payload> {
  /** Descriptor discriminator retained for runtime checks. */
  kind: "event";
  /** Phantom type anchor for event payload inference. */
  _payload?: Payload;
}

/**
 * Helper for declaring RPC endpoints with optional runtime validators.
 */
export function rpc<Req = unknown, Res = unknown>(
  opts?: RpcDescriptorOptions<Req, Res>,
): RpcDescriptor<Req, Res> {
  return { kind: "rpc", ...(opts ?? {}) };
}

/**
 * Helper for declaring fire-and-forget events with optional runtime validation.
 */
export function event<Payload = unknown>(
  opts?: EventDescriptorOptions<Payload>,
): EventDescriptor<Payload> {
  return { kind: "event", ...(opts ?? {}) };
}

/**
 * Structural contract combining RPC and event descriptors for both directions.
 */
export interface ContractShape {
  /** RPC definitions the client may call on the server. */
  rpcToServer?: Record<string, RpcDescriptor<unknown, unknown>>;
  /** RPC definitions the server may call on the client. */
  rpcToClient?: Record<string, RpcDescriptor<unknown, unknown>>;
  /** Event channels the client may emit to the server. */
  events?: Record<string, EventDescriptor<unknown>>;
}

/**
 * Identity helper preserving strong inference for contract literals.
 */
export function defineContract<const C extends ContractShape>(c: C): C {
  return c;
}

/**
 * Extracts the request payload type from an RPC descriptor.
 */
export type ExtractReq<D> = D extends RpcDescriptor<infer A, unknown>
  ? A
  : never;

/**
 * Extracts the response payload type from an RPC descriptor.
 */
export type ExtractRes<D> = D extends RpcDescriptor<unknown, infer B>
  ? B
  : never;

/**
 * Extracts the payload type from an event descriptor.
 */
export type ExtractEventPayload<D> = D extends EventDescriptor<infer P>
  ? P
  : never;

/**
 * Normalised client-side RPC call signatures targeting server handlers.
 */
export type RpcToServerMethods<C extends ContractShape> =
  C["rpcToServer"] extends Record<string, RpcDescriptor<unknown, unknown>>
    ? {
        /** Invokes server RPC K with a strongly typed request payload. */
        [K in keyof C["rpcToServer"]]: (
          req: ExtractReq<C["rpcToServer"][K]>,
        ) => Promise<ExtractRes<C["rpcToServer"][K]>>;
      }
    : never;

/**
 * Normalised server-initiated RPC call signatures targeting client handlers.
 */
export type RpcToClientMethods<C extends ContractShape> =
  C["rpcToClient"] extends Record<string, RpcDescriptor<unknown, unknown>>
    ? {
        /** Invokes client RPC K with a strongly typed request payload. */
        [K in keyof C["rpcToClient"]]: (
          req: ExtractReq<C["rpcToClient"][K]>,
        ) => Promise<ExtractRes<C["rpcToClient"][K]>>;
      }
    : never;

/**
 * Derived event emitter signatures aligned with the declared contract.
 */
export type EventEmitters<C extends ContractShape> = C["events"] extends Record<
  string,
  EventDescriptor<unknown>
>
  ? {
      /** Emits event K with a validated payload. */
      [K in keyof C["events"]]: (
        payload: ExtractEventPayload<C["events"][K]>,
      ) => void;
    }
  : never;

/**
 * Map of server-side RPC handlers servicing client requests.
 */
export type RpcToServerHandlerMap<C extends ContractShape> =
  C["rpcToServer"] extends Record<string, RpcDescriptor<unknown, unknown>>
    ? {
        /** Handles client-initiated RPC K using the supplied payload and metadata. */
        [K in keyof C["rpcToServer"]]: (
          req: ExtractReq<C["rpcToServer"][K]>,
          meta: Envelope,
        ) => Promise<ExtractRes<C["rpcToServer"][K]>>;
      }
    : never;

/**
 * Map of client-side RPC handlers servicing server-initiated calls.
 */
export type RpcToClientHandlerMap<C extends ContractShape> =
  C["rpcToClient"] extends Record<string, RpcDescriptor<unknown, unknown>>
    ? {
        /** Handles server-initiated RPC K using the supplied payload and metadata. */
        [K in keyof C["rpcToClient"]]: (
          req: ExtractReq<C["rpcToClient"][K]>,
          meta: Envelope,
        ) => Promise<ExtractRes<C["rpcToClient"][K]>>;
      }
    : never;

/**
 * Map of event handlers keyed by event name for incoming notifications.
 */
export type EventHandlerMap<C extends ContractShape> =
  C["events"] extends Record<string, EventDescriptor<unknown>>
    ? {
        /** Handles incoming event K with its payload and envelope metadata. */
        [K in keyof C["events"]]?: (
          payload: ExtractEventPayload<C["events"][K]>,
          meta: Envelope,
        ) => void | Promise<void>;
      }
    : never;

/**
 * Client runtime surface exposing RPC calls, event emitters, and subscription helpers.
 */
export interface RuntimeClient<C extends ContractShape> {
  /** Bound RPC proxy functions for invoking server endpoints. */
  rpc: RpcToServerMethods<C>;
  /** Event emitter functions aligned with the contract definition. */
  emit: EventEmitters<C>;
  /** Closes the underlying transport and rejects pending RPC calls. */
  close(): void;
  /** Transport used by the runtime for all network I/O. */
  transport: Transport;
  /** Registers an event handler returning a disposer that removes the subscription. */
  onEvent: <K extends keyof EventHandlerMap<C> & string>(
    name: K,
    handler: NonNullable<EventHandlerMap<C>[K]>,
  ) => () => void;
}

/**
 * Client runtime extended with handlers that service RPC calls initiated by the server.
 */
export interface ClientWithServerRpc<C extends ContractShape>
  extends RuntimeClient<C> {
  /** Handler implementations resolving server-initiated RPC invocations. */
  handlersForServerCalls: RpcToClientHandlerMap<C>;
}

/**
 * Active server-side connection exposing RPC proxies and lifecycle controls.
 */
export interface ServerConnection<C extends ContractShape> {
  /** Transport backing this logical connection. */
  transport: Transport;
  /** RPC proxy for calling methods exposed by the connected client. */
  callClient: RpcToClientMethods<C>;
  /** Terminates the connection and releases associated resources. */
  close(): void;
}

/**
 * Server runtime surface accepting connections and managing lifecycle.
 */
export interface RuntimeServer<C extends ContractShape> {
  /** Registers a callback fired for every newly accepted connection. */
  onConnection(cb: (conn: ServerConnection<C>) => void): void;
  /** Closes the runtime, disconnecting all active connections. */
  close(): void;
}
