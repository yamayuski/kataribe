import type { Transport } from "@kataribe/core";

export interface BunWebSocketTransportOptions {
  ws: import("bun").ServerWebSocket;
  onOpen?: () => void;
  onClose?: (code?: number, reason?: string) => void;
  onError?: (err: unknown) => void;
}

export class BunWebSocketTransport implements Transport {
  private socket: import("bun").ServerWebSocket;
  private listeners = new Set<(data: unknown) => void>();
  private opts: BunWebSocketTransportOptions;
  private closed = false;

  constructor(options: BunWebSocketTransportOptions) {
    this.opts = options;
    this.socket = options.ws;

    // Bun WebSocket events are handled differently
    // The events are set up in the Bun.serve configuration
  }

  send(data: unknown): void {
    if (!this.closed) {
      this.socket.send(typeof data === "string" ? data : JSON.stringify(data));
    }
  }

  onMessage(cb: (data: unknown) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  close(code?: number, reason?: string): void {
    if (!this.closed) {
      this.closed = true;
      this.socket.close(code, reason);
    }
  }

  isOpen(): boolean {
    return !this.closed && this.socket.readyState === WebSocket.OPEN;
  }

  // Internal method to dispatch messages to listeners
  _dispatchMessage(data: unknown): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  // Internal method to handle close
  _handleClose(code?: number, reason?: string): void {
    this.closed = true;
    this.opts.onClose?.(code, reason);
  }

  // Internal method to handle error
  _handleError(err: unknown): void {
    this.opts.onError?.(err);
  }
}
