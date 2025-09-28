import { MockNodeWebSocket } from "@kataribe/internal";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock isomorphic-ws with the shared mock
vi.mock("isomorphic-ws", () => ({
  default: MockNodeWebSocket,
}));

import { WebSocketTransport } from "./transport.ts";

// Helper type to access private properties for testing
type TransportWithPrivates = WebSocketTransport & {
  socket: MockNodeWebSocket;
};

describe("WebSocketTransport (Node.js)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set WebSocket constants globally
    global.WebSocket = {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    } as unknown as typeof WebSocket;
  });

  it("should create transport with URL", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    expect(transport).toBeDefined();
  });

  it("should throw error when neither url nor existing socket provided", () => {
    expect(() => new WebSocketTransport({})).toThrow(
      "WebSocketTransport requires url or existing socket",
    );
  });

  it("should send data when WebSocket is open", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });

    const testData = { message: "hello" };
    transport.send(testData);

    const socket = (transport as TransportWithPrivates).socket;
    expect(socket.sentData).toContain(JSON.stringify(testData));
  });

  it("should send string data as-is", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });

    const testData = "hello world";
    transport.send(testData);

    const socket = (transport as TransportWithPrivates).socket;
    expect(socket.sentData).toContain(testData);
  });

  it("should register and call message listeners", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    const messageListener = vi.fn();

    transport.onMessage(messageListener);

    const socket = (transport as TransportWithPrivates).socket;
    const testMessage = "test message";
    socket.simulateMessage(testMessage);

    expect(messageListener).toHaveBeenCalledWith(testMessage);
  });

  it("should unregister message listeners", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    const messageListener = vi.fn();

    const unsubscribe = transport.onMessage(messageListener);
    unsubscribe();

    const socket = (transport as TransportWithPrivates).socket;
    socket.simulateMessage("test message");

    expect(messageListener).not.toHaveBeenCalled();
  });

  it("should report correct open state", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });

    expect(transport.isOpen()).toBe(true);

    transport.close();
    expect(transport.isOpen()).toBe(false);
  });

  it("should handle protocols parameter", () => {
    const protocols = ["v1.kataribe.protocol"];
    const transport = new WebSocketTransport({
      url: "ws://localhost:8080",
      protocols,
    });

    const socket = (transport as TransportWithPrivates).socket;
    expect(socket.protocols).toBe(protocols);
  });
});
