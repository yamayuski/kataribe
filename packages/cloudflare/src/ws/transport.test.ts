import { describe, expect, it, vi, beforeEach } from "vitest";
import { CloudflareWebSocketTransport } from "./transport.ts";

// Mock Cloudflare WebSocket for testing
class MockCloudflareWebSocket {
  public readyState = 1; // OPEN
  private eventListeners: Record<string, Function[]> = {};
  public sentData: unknown[] = [];
  public accepted = false;

  addEventListener(type: string, listener: Function): void {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push(listener);
  }

  accept(): void {
    this.accepted = true;
    // Simulate open event after accept
    setTimeout(() => {
      this.dispatchEvent({ type: "open" });
    }, 0);
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

// Mock global WebSocket constants
beforeEach(() => {
  global.WebSocket = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  } as any;
});

describe("CloudflareWebSocketTransport", () => {
  it("should create transport with WebSocket and accept connection", () => {
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    const transport = new CloudflareWebSocketTransport({ webSocket: mockSocket });
    
    expect(transport).toBeDefined();
    expect((mockSocket as any).accepted).toBe(true);
  });

  it("should handle onOpen callback", async () => {
    const onOpen = vi.fn();
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    
    new CloudflareWebSocketTransport({ webSocket: mockSocket, onOpen });
    
    // Wait for async open event
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(onOpen).toHaveBeenCalled();
  });

  it("should handle onClose callback", () => {
    const onClose = vi.fn();
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    
    const transport = new CloudflareWebSocketTransport({ webSocket: mockSocket, onClose });
    
    transport.close(1000, "test close");
    expect(onClose).toHaveBeenCalledWith(1000, "test close");
  });

  it("should handle onError callback", async () => {
    const onError = vi.fn();
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    
    new CloudflareWebSocketTransport({ webSocket: mockSocket, onError });
    
    // Wait for transport to be ready then simulate error
    await new Promise(resolve => setTimeout(resolve, 10));
    
    (mockSocket as any).simulateError();
    expect(onError).toHaveBeenCalled();
  });

  it("should send data when WebSocket is open", () => {
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    const transport = new CloudflareWebSocketTransport({ webSocket: mockSocket });
    
    const testData = { message: "hello" };
    transport.send(testData);
    
    expect((mockSocket as any).sentData).toContain(JSON.stringify(testData));
  });

  it("should send string data as-is", () => {
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    const transport = new CloudflareWebSocketTransport({ webSocket: mockSocket });
    
    const testData = "hello world";
    transport.send(testData);
    
    expect((mockSocket as any).sentData).toContain(testData);
  });

  it("should register and call message listeners", () => {
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    const transport = new CloudflareWebSocketTransport({ webSocket: mockSocket });
    const messageListener = vi.fn();
    
    transport.onMessage(messageListener);
    
    const testMessage = "test message";
    (mockSocket as any).simulateMessage(testMessage);
    
    expect(messageListener).toHaveBeenCalledWith(testMessage);
  });

  it("should unregister message listeners", () => {
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    const transport = new CloudflareWebSocketTransport({ webSocket: mockSocket });
    const messageListener = vi.fn();
    
    const unsubscribe = transport.onMessage(messageListener);
    unsubscribe();
    
    (mockSocket as any).simulateMessage("test message");
    
    expect(messageListener).not.toHaveBeenCalled();
  });

  it("should report correct open state", () => {
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    const transport = new CloudflareWebSocketTransport({ webSocket: mockSocket });
    
    expect(transport.isOpen()).toBe(true);
    
    transport.close();
    expect(transport.isOpen()).toBe(false);
  });

  it("should not send data when WebSocket is not open", () => {
    const mockSocket = new MockCloudflareWebSocket() as unknown as WebSocket;
    // Set socket to closed state
    (mockSocket as any).readyState = 3; // CLOSED
    
    const transport = new CloudflareWebSocketTransport({ webSocket: mockSocket });
    
    const testData = { message: "hello" };
    transport.send(testData);
    
    // Should not have sent any data
    expect((mockSocket as any).sentData).toHaveLength(0);
  });
});