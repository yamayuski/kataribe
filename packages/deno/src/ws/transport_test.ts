// Mock the global WebSocket for Deno testing BEFORE importing anything
import { MockDenoWebSocket } from "@kataribe/internal";

// Now import the transport
import { WebSocketTransport } from "./transport.ts";

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
  } catch (error: unknown) {
    didThrow = true;
    if (ErrorClass && !(error instanceof ErrorClass)) {
      const errorName =
        error instanceof Error ? error.constructor.name : "unknown";
      throw new Error(`Expected ${ErrorClass.name}, got ${errorName}`);
    }
    if (
      msgIncludes &&
      error instanceof Error &&
      !error.message.includes(msgIncludes)
    ) {
      throw new Error(
        `Expected error message to include "${msgIncludes}", got "${error.message}"`,
      );
    }
  }
  if (!didThrow) {
    throw new Error("Expected function to throw an error");
  }
}

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

Deno.test("WebSocketTransport - should send data when using existing socket", () => {
  const mockSocket = new MockDenoWebSocket("ws://test") as unknown as WebSocket;
  const transport = new WebSocketTransport({ existing: mockSocket });

  const testData = { message: "hello" };
  transport.send(testData);

  // Access the mock socket through the transport's private property
  const socket = (transport as unknown as { socket: MockDenoWebSocket }).socket;
  assertEquals(socket.sentData.includes(JSON.stringify(testData)), true);
});

Deno.test("WebSocketTransport - should send string data as-is when using existing socket", () => {
  const mockSocket = new MockDenoWebSocket("ws://test") as unknown as WebSocket;
  const transport = new WebSocketTransport({ existing: mockSocket });

  const testData = "hello world";
  transport.send(testData);

  const socket = (transport as unknown as { socket: MockDenoWebSocket }).socket;
  assertEquals(socket.sentData.includes(testData), true);
});

Deno.test("WebSocketTransport - should register message listeners with existing socket", () => {
  const mockSocket = new MockDenoWebSocket("ws://test") as unknown as WebSocket;
  const transport = new WebSocketTransport({ existing: mockSocket });

  let messageReceived: unknown = null;
  const messageListener = (data: unknown) => {
    messageReceived = data;
  };

  transport.onMessage(messageListener);

  const socket = (transport as unknown as { socket: MockDenoWebSocket }).socket;
  const testMessage = "test message";
  socket.simulateMessage(testMessage);

  assertEquals(messageReceived, testMessage);
});

Deno.test("WebSocketTransport - should report correct open state with existing socket", () => {
  const mockSocket = new MockDenoWebSocket("ws://test") as unknown as WebSocket;
  const transport = new WebSocketTransport({ existing: mockSocket });

  assertEquals(transport.isOpen(), true);

  transport.close();
  assertEquals(transport.isOpen(), false);
});

Deno.test("WebSocketTransport - should handle close events with existing socket", () => {
  const mockSocket = new MockDenoWebSocket("ws://test") as unknown as WebSocket;
  let closeCalled = false;
  const onClose = () => {
    closeCalled = true;
  };

  const transport = new WebSocketTransport({
    existing: mockSocket,
    onClose,
  });

  transport.close();
  assertEquals(closeCalled, true);
});
