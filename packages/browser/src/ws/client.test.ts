import { defineContract, event, rpc } from "@kataribe/core";
import { MockWebSocket } from "@kataribe/internal";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWsClient } from "./client.ts";

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
