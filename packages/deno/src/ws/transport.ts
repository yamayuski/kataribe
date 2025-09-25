import type { Transport } from "@kataribe/core";

export interface WebSocketTransportOptions {
  url?: string;
  existing?: WebSocket;
  protocols?: string | string[];
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (err: Event) => void;
}

export class WebSocketTransport implements Transport {
  private socket: WebSocket;
  private listeners = new Set<(data: unknown) => void>();
  private opts: WebSocketTransportOptions;

  constructor(options: WebSocketTransportOptions) {
    this.opts = options;

    if (options.existing) {
      this.socket = options.existing;
    } else if (options.url) {
      this.socket = new WebSocket(options.url, options.protocols);
    } else {
      throw new Error("Either 'url' or 'existing' WebSocket must be provided");
    }

    this.socket.addEventListener("open", () => {
      this.opts.onOpen?.();
    });

    this.socket.addEventListener("close", (ev) => {
      this.opts.onClose?.(ev);
    });

    this.socket.addEventListener("error", (err) => {
      this.opts.onError?.(err);
    });

    this.socket.addEventListener("message", (ev) => {
      const data = typeof ev.data === "string" ? ev.data : ev.data;
      for (const listener of this.listeners) {
        listener(data);
      }
    });
  }

  // Method to update callbacks (for internal use)
  updateCallbacks(callbacks: Partial<WebSocketTransportOptions>): void {
    if (callbacks.onOpen) this.opts.onOpen = callbacks.onOpen;
    if (callbacks.onClose) this.opts.onClose = callbacks.onClose;
    if (callbacks.onError) this.opts.onError = callbacks.onError;
  }

  send(data: unknown): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(typeof data === "string" ? data : JSON.stringify(data));
    }
  }

  onMessage(cb: (data: unknown) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  close(code?: number, reason?: string): void {
    this.socket.close(code, reason);
  }

  isOpen(): boolean {
    return this.socket.readyState === WebSocket.OPEN;
  }
}
