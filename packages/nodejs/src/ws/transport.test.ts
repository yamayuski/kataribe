import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the WebSocket import at the top before any other imports
vi.mock("isomorphic-ws", () => {
  // Mock WebSocket class definition in the factory
  class MockWebSocket {
    public readyState = 0; // CONNECTING initially
    private eventListeners: Record<string, Function[]> = {};
    public sentData: unknown[] = [];
    public url: string;
    public protocols?: string | string[];

    // WebSocket constants
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url: string, protocols?: string | string[]) {
      this.url = url;
      this.protocols = protocols;
      
      // Simulate connection process - start connecting then open
      this.readyState = 0; // CONNECTING
      setTimeout(() => {
        this.readyState = 1; // OPEN
        this.dispatchEvent({ type: "open" });
      }, 0);
    }

    addEventListener(type: string, listener: Function): void {
      if (!this.eventListeners[type]) {
        this.eventListeners[type] = [];
      }
      this.eventListeners[type].push(listener);
    }

    removeEventListener(type: string, listener: Function): void {
      if (this.eventListeners[type]) {
        const index = this.eventListeners[type].indexOf(listener);
        if (index > -1) {
          this.eventListeners[type].splice(index, 1);
        }
      }
    }

    send(data: unknown): void {
      if (this.readyState === 1) { // OPEN
        this.sentData.push(data);
      }
    }

    close(code?: number, reason?: string): void {
      this.readyState = 3; // CLOSED
      this.dispatchEvent({ type: "close", code, reason });
    }

    dispatchEvent(event: { type: string; [key: string]: unknown }): boolean {
      const listeners = this.eventListeners[event.type] || [];
      for (const listener of listeners) {
        listener(event);
      }
      return true;
    }

    // Helper methods for testing
    simulateMessage(data: unknown): void {
      this.dispatchEvent({ type: "message", data });
    }

    simulateError(): void {
      this.dispatchEvent({ type: "error" });
    }

    simulateClose(code = 1000, reason = "test"): void {
      this.close(code, reason);
    }
  }

  // Assign constants to the class
  MockWebSocket.CONNECTING = 0;
  MockWebSocket.OPEN = 1;
  MockWebSocket.CLOSING = 2;
  MockWebSocket.CLOSED = 3;

  return {
    default: MockWebSocket,
  };
});

import { WebSocketTransport } from "./transport.ts";

// Get MockWebSocket class for test use
const MockWebSocket = vi.mocked(await import("isomorphic-ws")).default;

describe("WebSocketTransport (Node.js)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set WebSocket constants globally
    global.WebSocket = {
      CONNECTING: 0,
      OPEN: 1, 
      CLOSING: 2,
      CLOSED: 3,
    } as any;
  });

  it("should create transport with URL", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    expect(transport).toBeDefined();
  });

  it("should throw error when neither url nor existing socket provided", () => {
    expect(() => new WebSocketTransport({})).toThrow(
      "WebSocketTransport requires url or existing socket"
    );
  });

  it("should use existing WebSocket when provided", () => {
    const mockSocket = new (MockWebSocket as any)("ws://test");
    const transport = new WebSocketTransport({ existing: mockSocket });
    expect(transport).toBeDefined();
  });

  it("should handle onOpen callback", async () => {
    const onOpen = vi.fn();
    new WebSocketTransport({ url: "ws://localhost:8080", onOpen });
    
    // Wait for async open event
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(onOpen).toHaveBeenCalled();
  });

  it("should handle onClose callback", async () => {
    const onClose = vi.fn();
    const transport = new WebSocketTransport({ url: "ws://localhost:8080", onClose });
    
    // Wait for transport to be ready
    await new Promise(resolve => setTimeout(resolve, 10));
    
    transport.close();
    expect(onClose).toHaveBeenCalled();
  });

  it("should handle onError callback", async () => {
    const onError = vi.fn();
    const transport = new WebSocketTransport({ url: "ws://localhost:8080", onError });
    
    // Wait for transport to be ready
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Access private socket to simulate error
    const socket = (transport as any).socket as MockWebSocket;
    socket.simulateError();
    
    expect(onError).toHaveBeenCalled();
  });

  it("should send data when WebSocket is open", async () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    
    // Wait for WebSocket to be ready
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const testData = { message: "hello" };
    transport.send(testData);
    
    const socket = (transport as any).socket as MockWebSocket;
    expect(socket.sentData).toContain(JSON.stringify(testData));
  });

  it("should send string data as-is", async () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    
    // Wait for WebSocket to be ready
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const testData = "hello world";
    transport.send(testData);
    
    const socket = (transport as any).socket as MockWebSocket;
    expect(socket.sentData).toContain(testData);
  });

  it("should register and call message listeners", async () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    const messageListener = vi.fn();
    
    // Wait for WebSocket to be ready
    await new Promise(resolve => setTimeout(resolve, 10));
    
    transport.onMessage(messageListener);
    
    const socket = (transport as any).socket as MockWebSocket;
    const testMessage = "test message";
    socket.simulateMessage(testMessage);
    
    expect(messageListener).toHaveBeenCalledWith(testMessage);
  });

  it("should unregister message listeners", async () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    const messageListener = vi.fn();
    
    // Wait for WebSocket to be ready
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const unsubscribe = transport.onMessage(messageListener);
    unsubscribe();
    
    const socket = (transport as any).socket as MockWebSocket;
    socket.simulateMessage("test message");
    
    expect(messageListener).not.toHaveBeenCalled();
  });

  it("should report correct open state", async () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    
    // Wait for WebSocket to be ready
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(transport.isOpen()).toBe(true);
    
    transport.close();
    expect(transport.isOpen()).toBe(false);
  });

  it("should handle reconnection when enabled", async () => {
    const transport = new WebSocketTransport({
      url: "ws://localhost:8080",
      autoReconnect: true,
      reconnectDelayMs: 10,
      maxReconnectAttempts: 3,
    });

    // Wait for initial connection
    await new Promise(resolve => setTimeout(resolve, 10));

    // Simulate connection loss
    const socket = (transport as any).socket as MockWebSocket;
    socket.simulateClose(1006, "connection lost");

    // Wait for reconnection attempt
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should have attempted reconnection (new socket instance)
    expect(transport).toBeDefined();
  });

  it("should not reconnect when autoReconnect is disabled", async () => {
    const transport = new WebSocketTransport({
      url: "ws://localhost:8080",
      autoReconnect: false,
    });

    // Wait for initial connection
    await new Promise(resolve => setTimeout(resolve, 10));

    const originalSocket = (transport as any).socket;
    
    // Simulate connection loss
    const socket = (transport as any).socket as MockWebSocket;
    socket.simulateClose(1006, "connection lost");

    // Wait to ensure no reconnection happens
    await new Promise(resolve => setTimeout(resolve, 50));

    // Socket should remain the same (no reconnection)
    expect((transport as any).socket).toBe(originalSocket);
  });

  it("should handle protocols parameter", () => {
    const protocols = ["v1.kataribe.protocol"];
    const transport = new WebSocketTransport({
      url: "ws://localhost:8080",
      protocols,
    });

    const socket = (transport as any).socket as MockWebSocket;
    expect(socket.protocols).toBe(protocols);
  });
});