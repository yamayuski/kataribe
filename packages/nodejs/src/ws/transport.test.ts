import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock isomorphic-ws with a simple mock
vi.mock("isomorphic-ws", () => ({
  default: class MockWebSocket {
    public readyState = 1; // OPEN
    public url: string;
    public protocols?: string | string[];
    public sentData: unknown[] = [];
    private eventListeners: Record<string, Function[]> = {};

    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url: string, protocols?: string | string[]) {
      this.url = url;
      this.protocols = protocols;
      this.readyState = 1; // Start OPEN for simplicity
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
      this.sentData.push(data);
    }

    close(code?: number, reason?: string): void {
      this.readyState = 3; // CLOSED
      const event = { type: "close", code, reason };
      this.dispatchEvent(event);
    }

    dispatchEvent(event: any): boolean {
      const listeners = this.eventListeners[event.type] || [];
      for (const listener of listeners) {
        listener(event);
      }
      return true;
    }

    // Test helpers
    simulateMessage(data: unknown): void {
      this.dispatchEvent({ type: "message", data });
    }
  },
}));

import { WebSocketTransport } from "./transport.ts";

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

  it("should send data when WebSocket is open", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    
    const testData = { message: "hello" };
    transport.send(testData);
    
    const socket = (transport as any).socket;
    expect(socket.sentData).toContain(JSON.stringify(testData));
  });

  it("should send string data as-is", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    
    const testData = "hello world";
    transport.send(testData);
    
    const socket = (transport as any).socket;
    expect(socket.sentData).toContain(testData);
  });

  it("should register and call message listeners", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    const messageListener = vi.fn();
    
    transport.onMessage(messageListener);
    
    const socket = (transport as any).socket;
    const testMessage = "test message";
    socket.simulateMessage(testMessage);
    
    expect(messageListener).toHaveBeenCalledWith(testMessage);
  });

  it("should unregister message listeners", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
    const messageListener = vi.fn();
    
    const unsubscribe = transport.onMessage(messageListener);
    unsubscribe();
    
    const socket = (transport as any).socket;
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

    const socket = (transport as any).socket;
    expect(socket.protocols).toBe(protocols);
  });
});