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

import { MockDenoWebSocket } from "@kataribe/internal";
import { WebSocketTransport } from "./transport.ts";

// Mock the global WebSocket constants
globalThis.WebSocket = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as unknown as typeof WebSocket;

// Override WebSocket constructor for testing
// @ts-expect-error - Mocking global for testing
globalThis.WebSocket = MockDenoWebSocket;
globalThis.WebSocket.CONNECTING = 0;
globalThis.WebSocket.OPEN = 1;
globalThis.WebSocket.CLOSING = 2;
globalThis.WebSocket.CLOSED = 3;

// Helper type to access private properties for testing
type TransportWithPrivates = WebSocketTransport & {
  socket: MockDenoWebSocket;
};

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
  const mockSocket = new MockDenoWebSocket("ws://test") as unknown as WebSocket;
  const transport = new WebSocketTransport({ existing: mockSocket });
  assertEquals(typeof transport, "object");
});

Deno.test("WebSocketTransport - should send data when WebSocket is open", () => {
  const transport = new WebSocketTransport({ url: "ws://localhost:8080" });

  const testData = { message: "hello" };
  transport.send(testData);

  const socket = (transport as TransportWithPrivates).socket;
  assertEquals(socket.sentData.includes(JSON.stringify(testData)), true);
});

Deno.test("WebSocketTransport - should send string data as-is", () => {
  const transport = new WebSocketTransport({ url: "ws://localhost:8080" });

  const testData = "hello world";
  transport.send(testData);

  const socket = (transport as TransportWithPrivates).socket;
  assertEquals(socket.sentData.includes(testData), true);
});

Deno.test("WebSocketTransport - should register message listeners", () => {
  const transport = new WebSocketTransport({ url: "ws://localhost:8080" });
  let messageReceived: unknown = null;
  const messageListener = (data: unknown) => {
    messageReceived = data;
  };

  transport.onMessage(messageListener);

  const socket = (transport as TransportWithPrivates).socket;
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
