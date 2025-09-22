import type { Transport } from "../../types.ts";

export interface WebSocketTransportOptions {
  url?: string;
  existing?: WebSocket | WebSocketLike;
  protocols?: string | string[];
  wsImpl?: unknown;
  autoReconnect?: boolean;
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
  onOpen?: () => void;
  onClose?: (ev: unknown) => void;
  onError?: (err: unknown) => void;
}

export interface WebSocketLike {
  readyState: number;
  send(data: unknown): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (...args: unknown[]) => void): void;
  removeEventListener(
    type: string,
    listener: (...args: unknown[]) => void,
  ): void;
}

type WsCtor = new (url: string, protocols?: string | string[]) => WebSocketLike;

export class WebSocketTransport implements Transport {
  private socket: WebSocketLike;
  private listeners = new Set<(data: unknown) => void>();
  private opts: WebSocketTransportOptions;
  private attempts = 0;
  private closed = false;

  constructor(opts: WebSocketTransportOptions) {
    this.opts = { reconnectDelayMs: 1000, maxReconnectAttempts: 10, ...opts };
    if (opts.existing) {
      this.socket = opts.existing as WebSocketLike;
      this.bind();
    } else if (opts.url) {
      this.socket = this.createSocket(opts.url, opts.protocols);
      this.bind();
    } else {
      throw new Error("WebSocketTransport requires url or existing socket");
    }
  }

  private createSocket(
    url: string,
    protocols?: string | string[],
  ): WebSocketLike {
    if (typeof WebSocket !== "undefined") {
      return new WebSocket(url, protocols) as unknown as WebSocketLike;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    let impl: unknown;
    if (this.opts.wsImpl) {
      impl = this.opts.wsImpl;
    } else {
      try {
        // Try to use require if available (Node.js environment)
        // biome-ignore lint/suspicious/noExplicitAny: globalThis typing requires any
        impl = (globalThis as any).require?.("ws");
        if (!impl) {
          throw new Error("require not available");
        }
      } catch {
        throw new Error(
          "WebSocket implementation not found: 'wsImpl' not provided and 'require' is unavailable.",
        );
      }
    }
    return new (impl as WsCtor)(url, protocols);
  }

  private reconnect() {
    if (!this.opts.autoReconnect || this.closed) return;
    if (this.attempts >= (this.opts.maxReconnectAttempts ?? 0)) return;
    this.attempts++;
    setTimeout(() => {
      if (this.closed) return;
      if (!this.opts.url) return;
      this.socket = this.createSocket(this.opts.url, this.opts.protocols);
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
    if (this.socket.readyState === 0) {
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
    if (this.socket.readyState !== 1) throw new Error("WebSocket not open");
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
    return this.socket.readyState === 1;
  }
}
