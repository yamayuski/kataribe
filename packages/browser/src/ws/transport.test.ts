import { MockWebSocket } from "@kataribe/internal";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketTransport } from "./transport.ts";

// Helper type to access private properties for testing
type TransportWithPrivates = WebSocketTransport & {
  socket: MockWebSocket;
};

// Mock the global WebSocket
beforeEach(() => {
  // @ts-expect-error - Replacing global for testing
  global.WebSocket = MockWebSocket;
  global.WebSocket.CONNECTING = 0;
  global.WebSocket.OPEN = 1;
  global.WebSocket.CLOSING = 2;
  global.WebSocket.CLOSED = 3;
});

describe("WebSocketTransport", () => {
  it("should create transport with URL", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    expect(transport).toBeDefined();
  });

  it("should throw error when neither url nor existing socket provided", () => {
    expect(() => new WebSocketTransport({})).toThrow(
      "Either 'url' or 'existing' WebSocket must be provided",
    );
  });

  it("should use existing WebSocket when provided", () => {
    const mockSocket = new MockWebSocket("ws://test") as unknown as WebSocket;
    const transport = new WebSocketTransport({ existing: mockSocket });
    expect(transport).toBeDefined();
  });

  it("should handle onOpen callback", async () => {
    const onOpen = vi.fn();
    new WebSocketTransport({ url: "ws://localhost:8080", onOpen });

    // Wait for async open event
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onOpen).toHaveBeenCalled();
  });

  it("should handle onClose callback", () => {
    const onClose = vi.fn();
    const transport = new WebSocketTransport({
      url: "ws://localhost:8080",
      onClose,
    });

    transport.close(1000, "test close");
    expect(onClose).toHaveBeenCalled();
  });

  it("should handle onError callback", async () => {
    const onError = vi.fn();
    const transport = new WebSocketTransport({
      url: "ws://localhost:8080",
      onError,
    });

    // Wait for transport to be ready
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Access private socket to simulate error
    const socket = (transport as TransportWithPrivates).socket as MockWebSocket;
    socket.simulateError();

    expect(onError).toHaveBeenCalled();
  });

  it("should send data when WebSocket is open", async () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });

    // Wait for WebSocket to be open
    await new Promise((resolve) => setTimeout(resolve, 10));

    const testData = { message: "hello" };
    transport.send(testData);

    const socket = (transport as TransportWithPrivates).socket as MockWebSocket;
    expect(socket.sentData).toContain(JSON.stringify(testData));
  });

  it("should send string data as-is", async () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });

    // Wait for WebSocket to be open
    await new Promise((resolve) => setTimeout(resolve, 10));

    const testData = "hello world";
    transport.send(testData);

    const socket = (transport as TransportWithPrivates).socket as MockWebSocket;
    expect(socket.sentData).toContain(testData);
  });

  it("should register and call message listeners", async () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    const messageListener = vi.fn();

    // Wait for WebSocket to be ready
    await new Promise((resolve) => setTimeout(resolve, 10));

    transport.onMessage(messageListener);

    const socket = (transport as TransportWithPrivates).socket as MockWebSocket;
    const testMessage = "test message";
    socket.simulateMessage(testMessage);

    expect(messageListener).toHaveBeenCalledWith(testMessage);
  });

  it("should unregister message listeners", async () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    const messageListener = vi.fn();

    // Wait for WebSocket to be ready
    await new Promise((resolve) => setTimeout(resolve, 10));

    const unsubscribe = transport.onMessage(messageListener);
    unsubscribe();

    const socket = (transport as TransportWithPrivates).socket as MockWebSocket;
    socket.simulateMessage("test message");

    expect(messageListener).not.toHaveBeenCalled();
  });

  it("should report correct open state", async () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });

    // Wait for WebSocket to be open
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(transport.isOpen()).toBe(true);

    transport.close();
    expect(transport.isOpen()).toBe(false);
  });

  it("should update callbacks", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    const newOnOpen = vi.fn();
    const newOnClose = vi.fn();
    const newOnError = vi.fn();

    transport.updateCallbacks({
      onOpen: newOnOpen,
      onClose: newOnClose,
      onError: newOnError,
    });

    // Verify callbacks were updated (this mainly tests the method exists and works)
    expect(() =>
      transport.updateCallbacks({ onOpen: newOnOpen }),
    ).not.toThrow();
  });
});
