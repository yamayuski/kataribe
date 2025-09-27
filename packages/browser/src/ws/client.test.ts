import { defineContract, event, rpc } from "@kataribe/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWsClient } from "./client.ts";

// Mock WebSocket for testing (same as transport test)
class MockWebSocket {
  public readyState = WebSocket.OPEN;
  private eventListeners: Record<string, Function[]> = {};
  public sentData: unknown[] = [];

  constructor(
    public url: string,
    public protocols?: string | string[],
  ) {
    this.readyState = WebSocket.CONNECTING;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
    }, 0);
  }

  addEventListener(type: string, listener: Function): void {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push(listener);
  }

  send(data: unknown): void {
    this.sentData.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSED;
    this.dispatchEvent(new CloseEvent("close", { code, reason }));
  }

  dispatchEvent(event: Event): boolean {
    const listeners = this.eventListeners[event.type] || [];
    for (const listener of listeners) {
      listener(event);
    }
    return true;
  }

  simulateMessage(data: unknown): void {
    const event = new MessageEvent("message", { data });
    this.dispatchEvent(event);
  }

  simulateError(): void {
    this.dispatchEvent(new Event("error"));
  }
}

// Mock the global WebSocket
beforeEach(() => {
  // @ts-expect-error
  global.WebSocket = MockWebSocket;
  global.WebSocket.CONNECTING = 0;
  global.WebSocket.OPEN = 1;
  global.WebSocket.CLOSING = 2;
  global.WebSocket.CLOSED = 3;
});

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

describe("createWsClient", () => {
  it("should create WebSocket client with URL", async () => {
    const client = await createWsClient({
      url: "ws://localhost:8080",
      contract: testContract,
    });

    expect(client).toBeDefined();
    expect(client.rpc).toBeDefined();
    expect(client.emit).toBeDefined();
    expect(client.close).toBeDefined();
  });

  it("should create WebSocket client with existing WebSocket", async () => {
    const mockSocket = new MockWebSocket("ws://test") as unknown as WebSocket;
    const client = await createWsClient({
      existing: mockSocket,
      contract: testContract,
    });

    expect(client).toBeDefined();
  });

  it("should handle connection callbacks", async () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();

    const client = await createWsClient({
      url: "ws://localhost:8080",
      contract: testContract,
      onOpen,
      onClose,
    });

    expect(client).toBeDefined();
    expect(onOpen).toHaveBeenCalled();
  });

  it("should handle server RPC handlers", async () => {
    const notifyHandler = vi.fn().mockResolvedValue(undefined);

    const client = await createWsClient({
      url: "ws://localhost:8080",
      contract: testContract,
      handlersForServerCalls: {
        notify: notifyHandler,
      },
    });

    expect(client).toBeDefined();
  });

  // Note: Connection error testing is complex with async WebSocket behavior
  // This functionality is better tested in integration tests

  it("should pass runtime options", async () => {
    const runtimeOptions = {
      version: 2,
      timeoutMs: 10000,
      generateId: () => "custom-id",
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };

    const client = await createWsClient({
      url: "ws://localhost:8080",
      contract: testContract,
      runtime: runtimeOptions,
    });

    expect(client).toBeDefined();
    // The client should be created with custom runtime options
    // This is mainly testing that the options are passed through without error
  });
});
