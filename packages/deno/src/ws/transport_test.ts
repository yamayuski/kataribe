// Simple assertion functions for testing
function assertEquals(actual: unknown, expected: unknown, msg?: string): void {
  if (actual !== expected) {
    throw new Error(msg || `Expected ${expected}, got ${actual}`);
  }
}

function assertThrows(fn: () => void, ErrorClass?: ErrorConstructor, msgIncludes?: string): void {
  let didThrow = false;
  try {
    fn();
  } catch (error) {
    didThrow = true;
    if (ErrorClass && !(error instanceof ErrorClass)) {
      throw new Error(`Expected ${ErrorClass.name}, got ${error.constructor.name}`);
    }
    if (msgIncludes && !error.message.includes(msgIncludes)) {
      throw new Error(`Expected error message to include "${msgIncludes}", got "${error.message}"`);
    }
  }
  if (!didThrow) {
    throw new Error("Expected function to throw an error");
  }
}
import { WebSocketTransport } from "./transport.ts";

// Mock WebSocket for Deno testing
class MockWebSocket {
  public readyState = WebSocket.OPEN;
  private eventListeners: Record<string, Function[]> = {};
  public sentData: unknown[] = [];

  constructor(public url: string, public protocols?: string | string[]) {
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

  // Helper method to simulate incoming messages
  simulateMessage(data: unknown): void {
    const event = new MessageEvent("message", { data });
    this.dispatchEvent(event);
  }

  // Helper method to simulate errors
  simulateError(): void {
    this.dispatchEvent(new Event("error"));
  }
}

// Mock the global WebSocket
// @ts-ignore - Replace global WebSocket for testing
globalThis.WebSocket = MockWebSocket as any;

Deno.test("WebSocketTransport - should create transport with URL", () => {
  const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
  assertEquals(typeof transport, "object");
});

Deno.test("WebSocketTransport - should throw error when neither url nor existing socket provided", () => {
  assertThrows(
    () => new WebSocketTransport({}),
    Error,
    "Either 'url' or 'existing' WebSocket must be provided"
  );
});

Deno.test("WebSocketTransport - should use existing WebSocket when provided", () => {
  const mockSocket = new MockWebSocket("ws://test") as unknown as WebSocket;
  const transport = new WebSocketTransport({ existing: mockSocket });
  assertEquals(typeof transport, "object");
});

Deno.test("WebSocketTransport - should handle onOpen callback", async () => {
  let openCalled = false;
  const onOpen = () => { openCalled = true; };
  
  new WebSocketTransport({ url: "ws://localhost:8080", onOpen });
  
  // Wait for async open event
  await new Promise(resolve => setTimeout(resolve, 10));
  assertEquals(openCalled, true);
});

Deno.test("WebSocketTransport - should handle onClose callback", () => {
  let closeCalled = false;
  const onClose = () => { closeCalled = true; };
  
  const transport = new WebSocketTransport({ url: "ws://localhost:8080", onClose });
  transport.close(1000, "test close");
  
  assertEquals(closeCalled, true);
});

Deno.test("WebSocketTransport - should send data when WebSocket is open", async () => {
  const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
  
  // Wait for WebSocket to be open
  await new Promise(resolve => setTimeout(resolve, 10));
  
  const testData = { message: "hello" };
  transport.send(testData);
  
  const socket = (transport as any).socket as MockWebSocket;
  assertEquals(socket.sentData.includes(JSON.stringify(testData)), true);
});

Deno.test("WebSocketTransport - should send string data as-is", async () => {
  const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
  
  // Wait for WebSocket to be open
  await new Promise(resolve => setTimeout(resolve, 10));
  
  const testData = "hello world";
  transport.send(testData);
  
  const socket = (transport as any).socket as MockWebSocket;
  assertEquals(socket.sentData.includes(testData), true);
});

Deno.test("WebSocketTransport - should register and call message listeners", async () => {
  const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
  let messageReceived: unknown = null;
  const messageListener = (data: unknown) => { messageReceived = data; };
  
  // Wait for WebSocket to be ready
  await new Promise(resolve => setTimeout(resolve, 10));
  
  transport.onMessage(messageListener);
  
  const socket = (transport as any).socket as MockWebSocket;
  const testMessage = "test message";
  socket.simulateMessage(testMessage);
  
  assertEquals(messageReceived, testMessage);
});

Deno.test("WebSocketTransport - should unregister message listeners", async () => {
  const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
  let messageReceived: unknown = null;
  const messageListener = (data: unknown) => { messageReceived = data; };
  
  // Wait for WebSocket to be ready
  await new Promise(resolve => setTimeout(resolve, 10));
  
  const unsubscribe = transport.onMessage(messageListener);
  unsubscribe();
  
  const socket = (transport as any).socket as MockWebSocket;
  socket.simulateMessage("test message");
  
  assertEquals(messageReceived, null);
});

Deno.test("WebSocketTransport - should report correct open state", async () => {
  const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
  
  // Wait for WebSocket to be open
  await new Promise(resolve => setTimeout(resolve, 10));
  
  assertEquals(transport.isOpen(), true);
  
  transport.close();
  assertEquals(transport.isOpen(), false);
});