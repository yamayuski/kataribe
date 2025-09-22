import type { Transport } from "@kataribe/core";

export interface CloudflareWebSocketTransportOptions {
  webSocket: WebSocket;
  onOpen?: () => void;
  onClose?: (code?: number, reason?: string) => void;
  onError?: (err: unknown) => void;
}

export class CloudflareWebSocketTransport implements Transport {
  private socket: WebSocket;
  private listeners = new Set<(data: unknown) => void>();
  private opts: CloudflareWebSocketTransportOptions;

  constructor(options: CloudflareWebSocketTransportOptions) {
    this.opts = options;
    this.socket = options.webSocket;

    // Accept the WebSocket connection
    this.socket.accept();

    this.socket.addEventListener("open", () => {
      this.opts.onOpen?.();
    });

    this.socket.addEventListener("close", (ev) => {
      this.opts.onClose?.(ev.code, ev.reason);
    });

    this.socket.addEventListener("error", (err) => {
      this.opts.onError?.(err);
    });

    this.socket.addEventListener("message", (ev) => {
      for (const listener of this.listeners) {
        listener(ev.data);
      }
    });
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
