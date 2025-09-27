import type { StandardSchemaV1 } from "@standard-schema/spec";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockTransport } from "../../internal/src/mockTransport.ts";
import {
  createClientRuntime,
  createServerConnection,
  createServerRuntime,
} from "./runtime.ts";
import type { Envelope, RuntimeOptions, Transport } from "./types.ts";
import { defineContract, event, rpc } from "./types.ts";

// Test contract
const testContract = defineContract({
  rpcToServer: {
    add: rpc<{ a: number; b: number }, number>(),
    echo: rpc<string, string>(),
  },
  rpcToClient: {
    notify: rpc<string, void>(),
  },
  events: {
    userJoined: event<{ userId: string; name: string }>(),
    message: event<{ text: string }>(),
  },
});

const flushMicrotasks = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

const standardSchemaVendor = "test-schemas" as const;

const addRequestSchema = {
  "~standard": {
    version: 1,
    vendor: standardSchemaVendor,
    validate(value: unknown) {
      if (typeof value !== "object" || value === null) {
        return { issues: [{ message: "Expected object" }] };
      }
      const { a, b } = value as { a?: unknown; b?: unknown };
      if (typeof a !== "number" || typeof b !== "number") {
        return { issues: [{ message: "a and b must be numbers" }] };
      }
      return { value: { a, b } };
    },
  },
} satisfies StandardSchemaV1<unknown, { a: number; b: number }>;

const addResponseSchema = {
  "~standard": {
    version: 1,
    vendor: standardSchemaVendor,
    validate(value: unknown) {
      if (typeof value !== "object" || value === null) {
        return { issues: [{ message: "Expected object" }] };
      }
      const { sum } = value as { sum?: unknown };
      if (typeof sum === "number" && Number.isFinite(sum)) {
        return { value: { sum } };
      }
      if (
        typeof sum === "string" &&
        sum.trim() !== "" &&
        !Number.isNaN(Number(sum))
      ) {
        return { value: { sum: Number(sum) } };
      }
      return { issues: [{ message: "sum must be number" }] };
    },
  },
} satisfies StandardSchemaV1<unknown, { sum: number }>;

const userJoinedSchema = {
  "~standard": {
    version: 1,
    vendor: standardSchemaVendor,
    validate(value: unknown) {
      if (typeof value !== "object" || value === null) {
        return { issues: [{ message: "Expected object" }] };
      }
      const { userId, name } = value as { userId?: unknown; name?: unknown };
      if (typeof userId !== "string" || userId.trim() === "") {
        return { issues: [{ message: "userId must be a non-empty string" }] };
      }
      if (typeof name !== "string" || name.trim() === "") {
        return { issues: [{ message: "name must be a non-empty string" }] };
      }
      return { value: { userId, name: name.trim() } };
    },
  },
} satisfies StandardSchemaV1<unknown, { userId: string; name: string }>;

const standardSchemaContract = defineContract({
  rpcToServer: {
    add: rpc<{ a: number; b: number }, { sum: number }>({
      schemaReq: addRequestSchema,
      schemaRes: addResponseSchema,
    }),
  },
  events: {
    userJoined: event<{ userId: string; name: string }>({
      schema: userJoinedSchema,
    }),
  },
});

describe("runtime", () => {
  let mockTransport: MockTransport;
  let mockOptions: RuntimeOptions;

  beforeEach(() => {
    mockTransport = new MockTransport();
    mockOptions = {
      version: 1,
      timeoutMs: 5000,
      generateId: () => "test-id-123",
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createClientRuntime", () => {
    it("should create a client runtime with basic functionality", () => {
      const client = createClientRuntime(
        mockTransport,
        testContract,
        undefined,
        mockOptions,
      );

      expect(client).toBeDefined();
      expect(client.rpc).toBeDefined();
      expect(client.emit).toBeDefined();
      expect(client.close).toBeDefined();
      expect(client.transport).toBe(mockTransport);
      expect(client.onEvent).toBeDefined();
    });

    it("should send hello message on creation", () => {
      createClientRuntime(mockTransport, testContract, undefined, mockOptions);

      const sentMessages = mockTransport.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const helloMessage = sentMessages[0] as Envelope;
      expect(helloMessage.kind).toBe("hello");
      expect(helloMessage.v).toBe(1);
      expect(helloMessage.ts).toBeTypeOf("number");
    });

    it("should handle RPC calls", async () => {
      const client = createClientRuntime(
        mockTransport,
        testContract,
        undefined,
        mockOptions,
      );
      mockTransport.clearSentMessages();

      // Start an RPC call
      const rpcPromise = client.rpc.add({ a: 5, b: 3 });

      // Wait for async middleware operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Check that RPC request was sent
      const sentMessages = mockTransport.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const rpcRequest = sentMessages[0] as Envelope;
      expect(rpcRequest.kind).toBe("rpc_req");
      expect(rpcRequest.ch).toBe("add");
      expect(rpcRequest.id).toBe("test-id-123");
      expect(rpcRequest.p).toEqual({ a: 5, b: 3 });

      // Simulate RPC response
      mockTransport.simulateMessage({
        v: 1,
        ts: Date.now(),
        kind: "rpc_res",
        id: "test-id-123",
        ch: "add",
        p: 8,
      });

      const result = await rpcPromise;
      expect(result).toBe(8);
    });

    it("should handle RPC errors", async () => {
      const client = createClientRuntime(
        mockTransport,
        testContract,
        undefined,
        mockOptions,
      );
      mockTransport.clearSentMessages();

      const rpcPromise = client.rpc.add({ a: 5, b: 3 });

      // Simulate RPC error response
      mockTransport.simulateMessage({
        v: 1,
        ts: Date.now(),
        kind: "rpc_err",
        id: "test-id-123",
        ch: "add",
        m: "Test error message",
      });

      await expect(rpcPromise).rejects.toThrow("Test error message");
    });

    it("should emit events", async () => {
      const client = createClientRuntime(
        mockTransport,
        testContract,
        undefined,
        mockOptions,
      );
      mockTransport.clearSentMessages();

      client.emit.userJoined({ userId: "123", name: "Alice" });

      // Wait for async middleware operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      const sentMessages = mockTransport.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const eventMessage = sentMessages[0] as Envelope;
      expect(eventMessage.kind).toBe("event");
      expect(eventMessage.ch).toBe("userJoined");
      expect(eventMessage.p).toEqual({ userId: "123", name: "Alice" });
    });

    it("should handle incoming events", async () => {
      const client = createClientRuntime(
        mockTransport,
        testContract,
        undefined,
        mockOptions,
      );
      const eventHandler = vi.fn();

      client.onEvent("message", eventHandler);

      // Simulate incoming event
      mockTransport.simulateMessage({
        v: 1,
        ts: Date.now(),
        kind: "event",
        ch: "message",
        p: { text: "Hello, World!" },
      });

      // Wait for async handling
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(eventHandler).toHaveBeenCalledWith(
        { text: "Hello, World!" },
        expect.objectContaining({
          kind: "event",
          ch: "message",
          p: { text: "Hello, World!" },
        }),
      );
    });

    it("should handle server-to-client RPC calls", async () => {
      const serverCallHandlers = {
        notify: vi.fn().mockResolvedValue(undefined),
      };

      const _client = createClientRuntime(
        mockTransport,
        testContract,
        serverCallHandlers,
        mockOptions,
      );

      // Simulate incoming RPC call from server
      mockTransport.simulateMessage({
        v: 1,
        ts: Date.now(),
        kind: "rpc_req",
        id: "server-call-123",
        ch: "notify",
        p: "Test notification",
      });

      // Wait for async handling
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(serverCallHandlers.notify).toHaveBeenCalledWith(
        "Test notification",
        expect.objectContaining({
          kind: "rpc_req",
          id: "server-call-123",
          ch: "notify",
        }),
      );

      // Check that response was sent
      const sentMessages = mockTransport.getSentMessages().slice(1); // Skip hello message
      expect(sentMessages).toHaveLength(1);

      const response = sentMessages[0] as Envelope;
      expect(response.kind).toBe("rpc_res");
      expect(response.id).toBe("server-call-123");
      expect(response.ch).toBe("notify");
    });

    it("should close properly", () => {
      const client = createClientRuntime(
        mockTransport,
        testContract,
        undefined,
        mockOptions,
      );

      expect(mockTransport.isOpen()).toBe(true);
      client.close();
      expect(mockTransport.isOpen()).toBe(false);
    });
  });

  describe("createServerRuntime", () => {
    it("should create server runtime and handle connections", () => {
      const handlers = {
        rpcToServer: {
          add: vi.fn().mockResolvedValue(8),
          echo: vi
            .fn()
            .mockImplementation((msg: string) => Promise.resolve(msg)),
        },
        events: {
          userJoined: vi.fn(),
          message: vi.fn(),
        },
      };

      let transportCallback: ((transport: Transport) => void) | undefined;
      const makeTransport = vi.fn((cb: (transport: Transport) => void) => {
        transportCallback = cb;
      });

      const server = createServerRuntime(
        makeTransport,
        testContract,
        handlers,
        mockOptions,
      );

      expect(server).toBeDefined();
      expect(server.close).toBeDefined();
      expect(makeTransport).toHaveBeenCalledWith(expect.any(Function));

      // Simulate new transport connection
      if (transportCallback) {
        transportCallback(mockTransport);
      }

      // Check that hello message was sent
      const sentMessages = mockTransport.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const helloMessage = sentMessages[0] as Envelope;
      expect(helloMessage.kind).toBe("hello");
    });

    it("should handle incoming RPC requests", async () => {
      const handlers = {
        rpcToServer: {
          add: vi.fn().mockResolvedValue(8),
          echo: vi
            .fn()
            .mockImplementation((msg: string) => Promise.resolve(msg)),
        },
      };

      let transportCallback: ((transport: Transport) => void) | undefined;
      const makeTransport = vi.fn((cb: (transport: Transport) => void) => {
        transportCallback = cb;
      });

      createServerRuntime(makeTransport, testContract, handlers, mockOptions);

      if (transportCallback) {
        transportCallback(mockTransport);
      }

      mockTransport.clearSentMessages();

      // Simulate incoming RPC request
      mockTransport.simulateMessage({
        v: 1,
        ts: Date.now(),
        kind: "rpc_req",
        id: "client-req-123",
        ch: "add",
        p: { a: 5, b: 3 },
      });

      // Wait for async handling
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(handlers.rpcToServer.add).toHaveBeenCalledWith(
        { a: 5, b: 3 },
        expect.objectContaining({
          kind: "rpc_req",
          id: "client-req-123",
          ch: "add",
        }),
      );

      // Check that response was sent
      const sentMessages = mockTransport.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const response = sentMessages[0] as Envelope;
      expect(response.kind).toBe("rpc_res");
      expect(response.id).toBe("client-req-123");
      expect(response.ch).toBe("add");
      expect(response.p).toBe(8);
    });

    it("should handle incoming events", async () => {
      const handlers = {
        events: {
          userJoined: vi.fn(),
        },
      };

      let transportCallback: ((transport: Transport) => void) | undefined;
      const makeTransport = vi.fn((cb: (transport: Transport) => void) => {
        transportCallback = cb;
      });

      createServerRuntime(makeTransport, testContract, handlers, mockOptions);

      if (transportCallback) {
        transportCallback(mockTransport);
      }

      // Simulate incoming event
      mockTransport.simulateMessage({
        v: 1,
        ts: Date.now(),
        kind: "event",
        ch: "userJoined",
        p: { userId: "123", name: "Alice" },
      });

      // Wait for async handling
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(handlers.events.userJoined).toHaveBeenCalledWith(
        { userId: "123", name: "Alice" },
        expect.objectContaining({
          kind: "event",
          ch: "userJoined",
        }),
      );
    });
  });

  describe("createServerConnection", () => {
    it("should create a server connection", () => {
      const handlers = {
        add: vi.fn().mockResolvedValue(8),
        echo: vi.fn().mockImplementation((msg: string) => Promise.resolve(msg)),
      };

      const connection = createServerConnection(
        mockTransport,
        testContract,
        mockOptions,
        handlers,
        undefined,
        () => "test-id",
        new Map(),
      );

      expect(connection).toBeDefined();
      expect(connection.callClient).toBeDefined();
      expect(connection.close).toBeDefined();
      expect(connection.transport).toBe(mockTransport);
    });
  });

  describe("standard schema integration", () => {
    it("validates RPC payloads using Standard Schema helpers", async () => {
      const client = createClientRuntime(
        mockTransport,
        standardSchemaContract,
        undefined as never,
        mockOptions,
      );
      mockTransport.clearSentMessages();

      await expect(
        client.rpc.add({ a: 1, b: "oops" } as unknown as {
          a: number;
          b: number;
        }),
      ).rejects.toThrow(/a and b must be numbers/);
      expect(mockTransport.getSentMessages()).toHaveLength(0);

      const rpcPromise = client.rpc.add({ a: 2, b: 3 });
      await flushMicrotasks();

      const sentMessages = mockTransport.getSentMessages();
      expect(sentMessages).toHaveLength(1);
      const rpcRequest = sentMessages[0] as Envelope;
      expect(rpcRequest.kind).toBe("rpc_req");
      expect(rpcRequest.p).toEqual({ a: 2, b: 3 });

      mockTransport.simulateMessage({
        v: 1,
        ts: Date.now(),
        kind: "rpc_res",
        id: "test-id-123",
        ch: "add",
        p: { sum: "5" },
      });

      await expect(rpcPromise).resolves.toEqual({ sum: 5 });
    });

    it("validates emitted events with Standard Schemas", async () => {
      const client = createClientRuntime(
        mockTransport,
        standardSchemaContract,
        undefined as never,
        mockOptions,
      );
      mockTransport.clearSentMessages();

      client.emit.userJoined({ userId: "user-1", name: " Alice " });
      await flushMicrotasks();

      const sentMessages = mockTransport.getSentMessages();
      expect(sentMessages).toHaveLength(1);
      const eventEnvelope = sentMessages[0] as Envelope;
      expect(eventEnvelope.kind).toBe("event");
      expect(eventEnvelope.p).toEqual({ userId: "user-1", name: "Alice" });

      const errorSpy = mockOptions.logger?.error as ViMock | undefined;
      if (!errorSpy) {
        throw new Error("logger error mock not configured");
      }
      errorSpy.mockClear();

      client.emit.userJoined({ userId: "", name: "Bob" });
      await flushMicrotasks();

      expect(errorSpy).toHaveBeenCalledWith("emit error", expect.any(Error));
      expect(mockTransport.getSentMessages()).toHaveLength(1);
    });

    it("validates inbound events using Standard Schemas", async () => {
      const client = createClientRuntime(
        mockTransport,
        standardSchemaContract,
        undefined as never,
        mockOptions,
      );
      const handler = vi.fn();
      client.onEvent("userJoined", handler);
      const errorSpy = mockOptions.logger?.error as ViMock | undefined;
      if (!errorSpy) {
        throw new Error("logger error mock not configured");
      }
      errorSpy.mockClear();

      mockTransport.simulateMessage({
        v: 1,
        ts: Date.now(),
        kind: "event",
        ch: "userJoined",
        p: { userId: "abc", name: " Eve " },
      });
      await flushMicrotasks();

      expect(handler).toHaveBeenCalledWith(
        { userId: "abc", name: "Eve" },
        expect.objectContaining({ kind: "event", ch: "userJoined" }),
      );

      handler.mockClear();
      errorSpy.mockClear();

      mockTransport.simulateMessage({
        v: 1,
        ts: Date.now(),
        kind: "event",
        ch: "userJoined",
        p: { userId: "", name: "Invalid" },
      });
      await flushMicrotasks();

      expect(handler).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        "event validation error",
        expect.any(Error),
      );
    });

    it("returns RPC errors when Standard Schema validation fails on the server", async () => {
      const handlers = {
        rpcToServer: {
          add: vi.fn().mockResolvedValue({ sum: 99 }),
        },
      };

      let transportCallback: ((transport: Transport) => void) | undefined;
      const makeTransport = vi.fn((cb: (transport: Transport) => void) => {
        transportCallback = cb;
      });

      createServerRuntime(
        makeTransport,
        standardSchemaContract,
        handlers,
        mockOptions,
      );

      if (transportCallback) {
        transportCallback(mockTransport);
      }

      mockTransport.clearSentMessages();

      mockTransport.simulateMessage({
        v: 1,
        ts: Date.now(),
        kind: "rpc_req",
        id: "rpc-invalid",
        ch: "add",
        p: { a: "oops", b: 3 },
      });
      await flushMicrotasks();

      expect(handlers.rpcToServer.add).not.toHaveBeenCalled();
      const sentMessages = mockTransport.getSentMessages();
      expect(sentMessages).toHaveLength(1);
      const errEnvelope = sentMessages[0] as Envelope;
      expect(errEnvelope.kind).toBe("rpc_err");
      expect(errEnvelope.m).toMatch(/a and b must be numbers/);
    });
  });
});

type ViMock = ReturnType<typeof vi.fn>;
