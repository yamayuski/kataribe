import WebSocket from "isomorphic-ws";
import type { Transport } from "../../types.ts";

export interface WebSocketTransportOptions {
  url?: string;
  existing?: WebSocket;
  protocols?: string | string[];
  autoReconnect?: boolean;
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
  onOpen?: () => void;
  onClose?: (ev: unknown) => void;
  onError?: (err: unknown) => void;
}

export class WebSocketTransport implements Transport {
  private socket: WebSocket;
  private listeners = new Set<(data: unknown) => void>();
  private opts: WebSocketTransportOptions;
  private attempts = 0;
  private closed = false;

  constructor(opts: WebSocketTransportOptions) {
    this.opts = { reconnectDelayMs: 1000, maxReconnectAttempts: 10, ...opts };
    if (opts.existing) {
      this.socket = opts.existing;
      this.bind();
    } else if (opts.url) {
      this.socket = new WebSocket(opts.url, opts.protocols);
      this.bind();
    } else {
      throw new Error("WebSocketTransport requires url or existing socket");
    }
  }

  private reconnect() {
    if (!this.opts.autoReconnect || this.closed) return;
    if (this.attempts >= (this.opts.maxReconnectAttempts ?? 0)) return;
    this.attempts++;
    setTimeout(() => {
      if (this.closed) return;
      if (!this.opts.url) return;
      this.socket = new WebSocket(this.opts.url, this.opts.protocols);
      this.bind();
    }, this.opts.reconnectDelayMs);
  }

  private bind() {
    this.socket.addEventListener("message", (ev: unknown) => {
      const data = (ev as { data?: unknown })?.data ?? ev;
      for (const l of this.listeners) {
        l(data);
      }
    });
    this.socket.addEventListener("open", () => {
      this.attempts = 0;
      this.opts.onOpen?.();
    });
    this.socket.addEventListener("close", (ev: unknown) => {
      this.opts.onClose?.(ev);
      this.reconnect();
    });
    this.socket.addEventListener("error", (err: unknown) => {
      this.opts.onError?.(err);
    });
  }

  send(data: unknown): void | Promise<void> {
    if (this.socket.readyState === WebSocket.CONNECTING) {
      return new Promise<void>((resolve, reject) => {
        const onOpen = () => {
          this.socket.removeEventListener("open", onOpen);
          try {
            const payload =
              typeof data === "string" ? data : JSON.stringify(data);
            this.socket.send(payload);
            resolve();
          } catch (e) {
            reject(e);
          }
        };
        this.socket.addEventListener("open", onOpen);
      });
    }
    if (this.socket.readyState !== WebSocket.OPEN)
      throw new Error("WebSocket not open");
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    this.socket.send(payload);
  }

  onMessage(cb: (data: unknown) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  close(code?: number, reason?: string): void {
    this.closed = true;
    try {
      this.socket.close(code, reason);
    } catch {
      // ignore
    }
  }

  isOpen(): boolean {
    return this.socket.readyState === WebSocket.OPEN;
  }
}
