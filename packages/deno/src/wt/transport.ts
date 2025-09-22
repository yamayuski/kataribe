import type { Transport } from "@kataribe/core";

export interface WebTransportTransportOptions {
  url?: string;
  existing?: WebTransportBidirectionalStream;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: unknown) => void;
}

export class WebTransportTransport implements Transport {
  private stream: WebTransportBidirectionalStream;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private listeners = new Set<(data: unknown) => void>();
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();
  private closed = false;

  constructor(options: WebTransportTransportOptions) {
    if (options.existing) {
      this.stream = options.existing;
      this.initializeStream(options);
    } else if (options.url) {
      throw new Error("WebTransport client connection not implemented yet");
    } else {
      throw new Error("Either 'url' or 'existing' stream must be provided");
    }
  }

  private async initializeStream(options: WebTransportTransportOptions) {
    this.writer = this.stream.writable.getWriter();
    this.reader = this.stream.readable.getReader();

    options.onOpen?.();
    this.readMessages(options);
  }

  private async readMessages(options: WebTransportTransportOptions) {
    try {
      while (!this.closed) {
        const { value, done } = await this.reader.read();
        if (done) {
          this.closed = true;
          options.onClose?.();
          break;
        }

        const text = this.decoder.decode(value);
        for (const listener of this.listeners) {
          listener(text);
        }
      }
    } catch (error) {
      this.closed = true;
      options.onError?.(error);
    }
  }

  async send(data: unknown): Promise<void> {
    if (this.closed) return;

    const text = typeof data === "string" ? data : JSON.stringify(data);
    const bytes = this.encoder.encode(text);
    await this.writer.write(bytes);
  }

  onMessage(cb: (data: unknown) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  close(): void {
    if (this.closed) return;

    this.closed = true;
    this.writer.close();
    this.reader.cancel();
  }

  isOpen(): boolean {
    return !this.closed;
  }
}
