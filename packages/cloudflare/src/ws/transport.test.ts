import { MockCloudflareWebSocket } from "@kataribe/internal";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CloudflareWebSocketTransport } from "./transport.ts";

// Mock global WebSocket constants
beforeEach(() => {
  global.WebSocket = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  } as unknown as typeof WebSocket;
});

describe("CloudflareWebSocketTransport", () => {
  it("should create transport with WebSocket and accept connection", () => {
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    const transport = new CloudflareWebSocketTransport({
      webSocket: mockSocket,
    });

    expect(transport).toBeDefined();
    expect((mockSocket as unknown as MockCloudflareWebSocket).accepted).toBe(
      true,
    );
  });

  it("should handle onOpen callback", async () => {
    const onOpen = vi.fn();
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;

    new CloudflareWebSocketTransport({ webSocket: mockSocket, onOpen });

    // Wait for async open event
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onOpen).toHaveBeenCalled();
  });

  it("should handle onClose callback", () => {
    const onClose = vi.fn();
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;

    const transport = new CloudflareWebSocketTransport({
      webSocket: mockSocket,
      onClose,
    });

    transport.close(1000, "test close");
    expect(onClose).toHaveBeenCalledWith(1000, "test close");
  });

  it("should handle onError callback", async () => {
    const onError = vi.fn();
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;

    new CloudflareWebSocketTransport({ webSocket: mockSocket, onError });

    // Wait for transport to be ready then simulate error
    await new Promise((resolve) => setTimeout(resolve, 10));

    (mockSocket as unknown as MockCloudflareWebSocket).simulateError();
    expect(onError).toHaveBeenCalled();
  });

  it("should send data when WebSocket is open", () => {
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    const transport = new CloudflareWebSocketTransport({
      webSocket: mockSocket,
    });

    const testData = { message: "hello" };
    transport.send(testData);

    expect(
      (mockSocket as unknown as MockCloudflareWebSocket).sentData,
    ).toContain(JSON.stringify(testData));
  });

  it("should send string data as-is", () => {
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    const transport = new CloudflareWebSocketTransport({
      webSocket: mockSocket,
    });

    const testData = "hello world";
    transport.send(testData);

    expect(
      (mockSocket as unknown as MockCloudflareWebSocket).sentData,
    ).toContain(testData);
  });

  it("should register and call message listeners", () => {
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    const transport = new CloudflareWebSocketTransport({
      webSocket: mockSocket,
    });
    const messageListener = vi.fn();

    transport.onMessage(messageListener);

    const testMessage = "test message";
    (mockSocket as unknown as MockCloudflareWebSocket).simulateMessage(
      testMessage,
    );

    expect(messageListener).toHaveBeenCalledWith(testMessage);
  });

  it("should unregister message listeners", () => {
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    const transport = new CloudflareWebSocketTransport({
      webSocket: mockSocket,
    });
    const messageListener = vi.fn();

    const unsubscribe = transport.onMessage(messageListener);
    unsubscribe();

    (mockSocket as unknown as MockCloudflareWebSocket).simulateMessage(
      "test message",
    );

    expect(messageListener).not.toHaveBeenCalled();
  });

  it("should report correct open state", () => {
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    const transport = new CloudflareWebSocketTransport({
      webSocket: mockSocket,
    });

    expect(transport.isOpen()).toBe(true);

    transport.close();
    expect(transport.isOpen()).toBe(false);
  });

  it("should not send data when WebSocket is not open", () => {
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    // Set socket to closed state
    (mockSocket as unknown as MockCloudflareWebSocket).readyState = 3; // CLOSED

    const transport = new CloudflareWebSocketTransport({
      webSocket: mockSocket,
    });

    const testData = { message: "hello" };
    transport.send(testData);

    // Should not have sent any data
    expect(
      (mockSocket as unknown as MockCloudflareWebSocket).sentData,
    ).toHaveLength(0);
  });
});
