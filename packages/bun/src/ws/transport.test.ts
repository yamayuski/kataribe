import { beforeEach, describe, expect, it } from "bun:test";
import { MockBunServerWebSocket } from "@kataribe/internal";
import { BunWebSocketTransport } from "./transport.ts";

// Helper type to access private methods for testing
type TransportWithPrivates = BunWebSocketTransport & {
  _dispatchMessage: (data: unknown) => void;
};

// Mock WebSocket constants
beforeEach(() => {
  globalThis.WebSocket = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  } as unknown as typeof WebSocket;
});

describe("BunWebSocketTransport", () => {
  it("should create transport with Bun ServerWebSocket", () => {
    const mockSocket =
      new MockBunServerWebSocket() as unknown as import("bun").ServerWebSocket;
    const transport = new BunWebSocketTransport({ ws: mockSocket });
    expect(transport).toBeDefined();
  });

  it("should send data when not closed", () => {
    const mockSocket =
      new MockBunServerWebSocket() as unknown as import("bun").ServerWebSocket;
    const transport = new BunWebSocketTransport({ ws: mockSocket });

    const testData = { message: "hello" };
    transport.send(testData);

    expect(
      (mockSocket as unknown as MockBunServerWebSocket).getSentData(),
    ).toContain(JSON.stringify(testData));
  });

  it("should send string data as-is", () => {
    const mockSocket =
      new MockBunServerWebSocket() as unknown as import("bun").ServerWebSocket;
    const transport = new BunWebSocketTransport({ ws: mockSocket });

    const testData = "hello world";
    transport.send(testData);

    expect(
      (mockSocket as unknown as MockBunServerWebSocket).getSentData(),
    ).toContain(testData);
  });

  it("should not send data when closed", () => {
    const mockSocket =
      new MockBunServerWebSocket() as unknown as import("bun").ServerWebSocket;
    const transport = new BunWebSocketTransport({ ws: mockSocket });

    transport.close();

    const testData = { message: "hello" };
    transport.send(testData);

    // Should not have sent any data
    expect(
      (mockSocket as unknown as MockBunServerWebSocket).getSentData(),
    ).toHaveLength(0);
  });

  it("should register and call message listeners", () => {
    const mockSocket =
      new MockBunServerWebSocket() as unknown as import("bun").ServerWebSocket;
    const transport = new BunWebSocketTransport({ ws: mockSocket });

    let messageReceived: unknown = null;
    const messageListener = (data: unknown) => {
      messageReceived = data;
    };

    transport.onMessage(messageListener);

    const testMessage = "test message";
    (transport as TransportWithPrivates)._dispatchMessage(testMessage);

    expect(messageReceived).toBe(testMessage);
  });

  it("should unregister message listeners", () => {
    const mockSocket =
      new MockBunServerWebSocket() as unknown as import("bun").ServerWebSocket;
    const transport = new BunWebSocketTransport({ ws: mockSocket });

    let messageReceived: unknown = null;
    const messageListener = (data: unknown) => {
      messageReceived = data;
    };

    const unsubscribe = transport.onMessage(messageListener);
    unsubscribe();

    (transport as TransportWithPrivates)._dispatchMessage("test message");

    expect(messageReceived).toBe(null);
  });

  it("should report correct open state", () => {
    const mockSocket =
      new MockBunServerWebSocket() as unknown as import("bun").ServerWebSocket;
    const transport = new BunWebSocketTransport({ ws: mockSocket });

    expect(transport.isOpen()).toBe(true);

    transport.close();
    expect(transport.isOpen()).toBe(false);
  });

  it("should close underlying socket with code and reason", () => {
    const mockSocket =
      new MockBunServerWebSocket() as unknown as import("bun").ServerWebSocket;
    const transport = new BunWebSocketTransport({ ws: mockSocket });

    transport.close(1000, "test close");

    expect((mockSocket as unknown as MockBunServerWebSocket).getClosed()).toBe(
      true,
    );
    expect(transport.isOpen()).toBe(false);
  });

  it("should not close twice", () => {
    const mockSocket =
      new MockBunServerWebSocket() as unknown as import("bun").ServerWebSocket;
    const transport = new BunWebSocketTransport({ ws: mockSocket });

    transport.close(1000, "first close");
    transport.close(1001, "second close");

    // Should only be closed once
    expect((mockSocket as unknown as MockBunServerWebSocket).getClosed()).toBe(
      true,
    );
  });

  it("should handle constructor options", () => {
    const mockSocket =
      new MockBunServerWebSocket() as unknown as import("bun").ServerWebSocket;
    const onOpen = () => {};
    const onClose = () => {};
    const onError = () => {};

    const transport = new BunWebSocketTransport({
      ws: mockSocket,
      onOpen,
      onClose,
      onError,
    });

    expect(transport).toBeDefined();
    // Constructor should accept all options without error
  });

  it("should dispatch messages to multiple listeners", () => {
    const mockSocket =
      new MockBunServerWebSocket() as unknown as import("bun").ServerWebSocket;
    const transport = new BunWebSocketTransport({ ws: mockSocket });

    let message1: unknown = null;
    let message2: unknown = null;

    const listener1 = (data: unknown) => {
      message1 = data;
    };
    const listener2 = (data: unknown) => {
      message2 = data;
    };

    transport.onMessage(listener1);
    transport.onMessage(listener2);

    const testMessage = "broadcast message";
    (transport as TransportWithPrivates)._dispatchMessage(testMessage);

    expect(message1).toBe(testMessage);
    expect(message2).toBe(testMessage);
  });
});
