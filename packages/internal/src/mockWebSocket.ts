// Mock WebSocket implementations for testing different runtime environments

type EventListener = (event: Event) => void;

// Mock WebSocket for browser/general testing
export class MockWebSocket {
  public readyState = WebSocket.OPEN;
  private eventListeners: Record<string, EventListener[]> = {};
  public sentData: unknown[] = [];

  constructor(
    public url: string,
    public protocols?: string | string[],
  ) {
    // Start with CONNECTING state and then open
    this.readyState = WebSocket.CONNECTING;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
    }, 0);
  }

  addEventListener(type: string, listener: EventListener): void {
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

// Mock WebSocket for Node.js testing (with constants)
export class MockNodeWebSocket {
  public readyState = 1; // OPEN
  public url: string;
  public protocols?: string | string[];
  public sentData: unknown[] = [];
  private eventListeners: Record<string, EventListener[]> = {};

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = 1; // Start OPEN for simplicity
  }

  addEventListener(type: string, listener: EventListener): void {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    if (this.eventListeners[type]) {
      const index = this.eventListeners[type].indexOf(listener);
      if (index > -1) {
        this.eventListeners[type].splice(index, 1);
      }
    }
  }

  send(data: unknown): void {
    if (this.readyState === 1) {
      // OPEN
      this.sentData.push(data);
    }
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3; // CLOSED
    this.dispatchEvent({ type: "close", code, reason } as Event);
  }

  dispatchEvent(event: Event): boolean {
    const listeners = this.eventListeners[event.type] || [];
    for (const listener of listeners) {
      listener(event);
    }
    return true;
  }

  // Test helpers
  simulateMessage(data: unknown): void {
    this.dispatchEvent({ type: "message", data } as Event);
  }
}

// Mock WebSocket for Cloudflare testing
export class MockCloudflareWebSocket {
  public readyState = 1; // OPEN
  private eventListeners: Record<string, EventListener[]> = {};
  public sentData: unknown[] = [];
  public accepted = false;

  addEventListener(type: string, listener: EventListener): void {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push(listener);
  }

  accept(): void {
    this.accepted = true;
    // Simulate open event after accept
    setTimeout(() => {
      this.dispatchEvent(new Event("open"));
    }, 0);
  }

  send(data: unknown): void {
    if (this.readyState === 1) {
      // OPEN
      this.sentData.push(data);
    }
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3; // CLOSED
    this.dispatchEvent(new CloseEvent("close", { code, reason }));
  }

  dispatchEvent(event: Event): boolean {
    const listeners = this.eventListeners[event.type] || [];
    for (const listener of listeners) {
      listener(event);
    }
    return true;
  }

  // Helper methods for testing
  simulateMessage(data: unknown): void {
    const event = new MessageEvent("message", { data });
    this.dispatchEvent(event);
  }

  simulateError(): void {
    this.dispatchEvent(new Event("error"));
  }

  simulateClose(code = 1000, reason = "test"): void {
    this.close(code, reason);
  }
}

// Mock WebSocket for Bun testing
export class MockBunServerWebSocket {
  public readyState = 1; // WebSocket.OPEN
  public sentData: unknown[] = [];
  private closed = false;

  send(data: unknown): void {
    if (!this.closed) {
      this.sentData.push(data);
    }
  }

  close(_code?: number, _reason?: string): void {
    this.closed = true;
    this.readyState = 3; // WebSocket.CLOSED
  }

  // Helper methods for testing
  getClosed(): boolean {
    return this.closed;
  }

  getSentData(): unknown[] {
    return [...this.sentData];
  }

  clearSentData(): void {
    this.sentData = [];
  }
}

// Mock WebSocket for Deno testing (simple version to avoid timer leaks)
export class MockDenoWebSocket {
  public readyState = 1; // OPEN
  private eventListeners: Record<string, EventListener[]> = {};
  public sentData: unknown[] = [];

  constructor(
    public url: string,
    public protocols?: string | string[],
  ) {
    // Start as OPEN for simplicity in tests
    this.readyState = 1; // OPEN
  }

  addEventListener(type: string, listener: EventListener): void {
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
