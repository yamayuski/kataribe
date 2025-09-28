import type { Transport } from "@kataribe/core";

// Mock transport implementation for testing
export class MockTransport implements Transport {
  private messageHandlers: ((data: unknown) => void)[] = [];
  private sentMessages: unknown[] = [];
  private _isOpen = true;

  send(data: unknown): void {
    this.sentMessages.push(data);
  }

  onMessage(cb: (data: unknown) => void): () => void {
    this.messageHandlers.push(cb);
    return () => {
      const index = this.messageHandlers.indexOf(cb);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  close(): void {
    this._isOpen = false;
  }

  isOpen(): boolean {
    return this._isOpen;
  }

  // Test helpers
  simulateMessage(data: unknown): void {
    for (const handler of this.messageHandlers) {
      handler(data);
    }
  }

  getSentMessages(): unknown[] {
    return [...this.sentMessages];
  }

  clearSentMessages(): void {
    this.sentMessages = [];
  }
}
