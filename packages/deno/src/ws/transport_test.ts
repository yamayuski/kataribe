// Simple assertion functions for testing
function assertEquals(actual: unknown, expected: unknown, msg?: string): void {
  if (actual !== expected) {
    throw new Error(msg || `Expected ${expected}, got ${actual}`);
  }
}

function assertThrows(
  fn: () => void,
  ErrorClass?: ErrorConstructor,
  msgIncludes?: string,
): void {
  let didThrow = false;
  try {
    fn();
  } catch (error) {
    didThrow = true;
    if (ErrorClass && !(error instanceof ErrorClass)) {
      throw new Error(
        `Expected ${ErrorClass.name}, got ${error.constructor.name}`,
      );
    }
    if (msgIncludes && !error.message.includes(msgIncludes)) {
      throw new Error(
        `Expected error message to include "${msgIncludes}", got "${error.message}"`,
      );
    }
  }
  if (!didThrow) {
    throw new Error("Expected function to throw an error");
  }
}

import { WebSocketTransport } from "./transport.ts";

// Mock WebSocket for Deno testing - simple version to avoid timer leaks
class MockWebSocket {
  public readyState = 1; // OPEN
  private eventListeners: Record<string, Function[]> = {};
  public sentData: unknown[] = [];

  constructor(
    public url: string,
    public protocols?: string | string[],
  ) {
    // Start as OPEN for simplicity in tests
    this.readyState = 1; // OPEN
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
    this.readyState = 3; // CLOSED
    const event = new CloseEvent("close", { code, reason });
    this.dispatchEvent(event);
  }

  dispatchEvent(event: Event): boolean {
    const listeners = this.eventListeners[event.type] || [];
    for (const listener of listeners) {
      listener(event);
    }
    return true;
  }

  // Helper method to simulate incoming messages
  simulateMessage(data: unknown): void {
    const event = new MessageEvent("message", { data });
    this.dispatchEvent(event);
  }
}

// Mock the global WebSocket constants
globalThis.WebSocket = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as any;

// Override WebSocket constructor for testing
// @ts-expect-error
globalThis.WebSocket = MockWebSocket as any;
globalThis.WebSocket.CONNECTING = 0;
globalThis.WebSocket.OPEN = 1;
globalThis.WebSocket.CLOSING = 2;
globalThis.WebSocket.CLOSED = 3;

Deno.test("WebSocketTransport - should create transport with URL", () => {
  const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
  assertEquals(typeof transport, "object");
});

Deno.test("WebSocketTransport - should throw error when neither url nor existing socket provided", () => {
  assertThrows(
    () => new WebSocketTransport({}),
    Error,
    "Either 'url' or 'existing' WebSocket must be provided",
  );
});

Deno.test("WebSocketTransport - should use existing WebSocket when provided", () => {
  const mockSocket = new MockWebSocket("ws://test") as unknown as WebSocket;
  const transport = new WebSocketTransport({ existing: mockSocket });
  assertEquals(typeof transport, "object");
});

Deno.test("WebSocketTransport - should send data when WebSocket is open", () => {
  const transport = new WebSocketTransport({ url: "ws://localhost:8080" });

  const testData = { message: "hello" };
  transport.send(testData);

  const socket = (transport as any).socket as MockWebSocket;
  assertEquals(socket.sentData.includes(JSON.stringify(testData)), true);
});

Deno.test("WebSocketTransport - should send string data as-is", () => {
  const transport = new WebSocketTransport({ url: "ws://localhost:8080" });

  const testData = "hello world";
  transport.send(testData);

  const socket = (transport as any).socket as MockWebSocket;
  assertEquals(socket.sentData.includes(testData), true);
});

Deno.test("WebSocketTransport - should register message listeners", () => {
  const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
  let messageReceived: unknown = null;
  const messageListener = (data: unknown) => {
    messageReceived = data;
  };

  transport.onMessage(messageListener);

  const socket = (transport as any).socket as MockWebSocket;
  const testMessage = "test message";
  socket.simulateMessage(testMessage);

  assertEquals(messageReceived, testMessage);
});

Deno.test("WebSocketTransport - should report correct open state", () => {
  const transport = new WebSocketTransport({ url: "ws://localhost:8080" });

  assertEquals(transport.isOpen(), true);

  transport.close();
  assertEquals(transport.isOpen(), false);
});
