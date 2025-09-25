import type { Transport } from "@kataribe/core";

export interface WebRTCTransportOptions {
  dataChannel?: RTCDataChannel;
  peerConnection?: RTCPeerConnection;
  onOpen?: () => void;
  onClose?: (ev: unknown) => void;
  onError?: (err: unknown) => void;
}

export class WebRTCDataChannelTransport implements Transport {
  private dataChannel: RTCDataChannel;
  private peerConnection?: RTCPeerConnection;
  private listeners = new Set<(data: unknown) => void>();
  private opts: WebRTCTransportOptions;

  constructor(opts: WebRTCTransportOptions) {
    this.opts = opts;
    if (!opts.dataChannel) {
      throw new Error("WebRTCDataChannelTransport requires dataChannel");
    }
    this.dataChannel = opts.dataChannel;
    this.peerConnection = opts.peerConnection;
    this.bind();
  }

  private bind() {
    this.dataChannel.addEventListener("message", (ev: MessageEvent) => {
      for (const l of this.listeners) {
        l(ev.data);
      }
    });

    this.dataChannel.addEventListener("open", () => {
      this.opts.onOpen?.();
    });

    this.dataChannel.addEventListener("close", (ev: Event) => {
      this.opts.onClose?.(ev);
    });

    this.dataChannel.addEventListener("error", (err: Event) => {
      this.opts.onError?.(err);
    });
  }

  send(data: unknown): void | Promise<void> {
    if (this.dataChannel.readyState === "connecting") {
      return new Promise<void>((resolve, reject) => {
        const onOpen = () => {
          this.dataChannel.removeEventListener("open", onOpen);
          try {
            const payload =
              typeof data === "string" ? data : JSON.stringify(data);
            this.dataChannel.send(payload);
            resolve();
          } catch (e) {
            reject(e);
          }
        };
        this.dataChannel.addEventListener("open", onOpen);
      });
    }
    if (this.dataChannel.readyState !== "open") {
      throw new Error("DataChannel not open");
    }
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    this.dataChannel.send(payload);
  }

  onMessage(cb: (data: unknown) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  close(_code?: number, _reason?: string): void {
    try {
      this.dataChannel.close();
      this.peerConnection?.close();
    } catch {
      // ignore
    }
  }

  isOpen(): boolean {
    return this.dataChannel.readyState === "open";
  }
}
