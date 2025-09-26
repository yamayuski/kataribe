import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createClientRuntime,
  createServerConnection,
  createServerRuntime,
} from "./runtime.ts";
import type { Envelope, RuntimeOptions, Transport } from "./types.ts";
import { defineContract, event, rpc } from "./types.ts";

// Mock transport implementation for testing
class MockTransport implements Transport {
  private messageHandlers: ((data: unknown) => void)[] = [];
  private sentMessages: unknown[] = [];
  private _isOpen = true;

  send(data: unknown): void {
    this.sentMessages.push(data);
  }

  onMessage(cb: (data: unknown) => void): () => void {
    this.messageHandlers.push(cb);
    return () => {
      const index = this.messageHandlers.indexOf(cb);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  close(): void {
    this._isOpen = false;
  }

  isOpen(): boolean {
    return this._isOpen;
  }

  // Test helpers
  simulateMessage(data: unknown): void {
    for (const handler of this.messageHandlers) {
      handler(data);
    }
  }

  getSentMessages(): unknown[] {
    return [...this.sentMessages];
  }

  clearSentMessages(): void {
    this.sentMessages = [];
  }
}

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
        {},
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
      createClientRuntime(mockTransport, testContract, {}, mockOptions);

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
        {},
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
        {},
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
        {},
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
        {},
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
        {},
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
});
