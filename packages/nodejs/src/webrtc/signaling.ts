import type {
  ContractShape,
  EventHandlerMap,
  RpcToServerHandlerMap,
  RuntimeOptions,
} from "@kataribe/core";

export interface SignalingServerParams<C extends ContractShape> {
  contract: C;
  handlers: {
    rpcToServer?: RpcToServerHandlerMap<C>;
    events?: EventHandlerMap<C>;
  };
  runtime?: RuntimeOptions;
  port: number;
  wsImpl?: unknown;
}

interface SignalingMessage {
  type:
    | "offer"
    | "answer"
    | "ice-candidate"
    | "join"
    | "peer-joined"
    | "peer-left";
  data?: unknown;
  peerId?: string;
  targetPeerId?: string;
}

interface PeerInfo {
  id: string;
  socket: unknown;
}

export async function createWebRTCSignalingServer<C extends ContractShape>(
  params: SignalingServerParams<C>,
): Promise<{
  close(): void;
  getPeerCount(): number;
}> {
  const { port, wsImpl } = params;

  // biome-ignore lint/suspicious/noExplicitAny: WebSocket module typing requires any
  let wsModule: any;

  if (wsImpl) {
    wsModule = wsImpl;
  } else {
    try {
      // Use string literal to avoid TypeScript module resolution during compilation
      wsModule = await import("ws");
    } catch (error) {
      throw new Error(`Failed to import 'ws' module: ${error}`);
    }
  }

  const wss = new (wsModule.Server || wsModule.WebSocketServer)({ port }) as {
    on(event: "connection", cb: (socket: unknown) => void): void;
    close(): void;
  };

  const peers = new Map<string, PeerInfo>();

  function generatePeerId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  function broadcastToPeers(message: SignalingMessage, excludePeerId?: string) {
    for (const [peerId, peer] of peers) {
      if (peerId !== excludePeerId) {
        const socket = peer.socket as {
          send(data: string): void;
          readyState: number;
        };
        if (socket.readyState === 1) {
          socket.send(JSON.stringify(message));
        }
      }
    }
  }

  function sendToPeer(peerId: string, message: SignalingMessage) {
    const peer = peers.get(peerId);
    if (peer) {
      const socket = peer.socket as {
        send(data: string): void;
        readyState: number;
      };
      if (socket.readyState === 1) {
        socket.send(JSON.stringify(message));
      }
    }
  }

  wss.on("connection", (socket: unknown) => {
    const peerId = generatePeerId();
    const peer: PeerInfo = { id: peerId, socket };
    peers.set(peerId, peer);

    console.log(`[Signaling] Peer ${peerId} connected`);

    const socketWithEvents = socket as {
      on(event: string, cb: (...args: unknown[]) => void): void;
      send(data: string): void;
      close(): void;
    };

    // Send initial peer ID
    socketWithEvents.send(
      JSON.stringify({
        type: "join",
        peerId,
      }),
    );

    // Notify other peers about new peer
    broadcastToPeers(
      {
        type: "peer-joined",
        peerId,
      },
      peerId,
    );

    socketWithEvents.on("message", (data: unknown) => {
      try {
        const message = JSON.parse(data as string) as SignalingMessage;

        switch (message.type) {
          case "offer":
          case "answer":
          case "ice-candidate":
            if (message.targetPeerId) {
              sendToPeer(message.targetPeerId, {
                ...message,
                peerId,
              });
            } else {
              // Broadcast to all other peers
              broadcastToPeers(
                {
                  ...message,
                  peerId,
                },
                peerId,
              );
            }
            break;
        }
      } catch (e) {
        console.error("[Signaling] Failed to parse message:", e);
      }
    });

    socketWithEvents.on("close", () => {
      console.log(`[Signaling] Peer ${peerId} disconnected`);
      peers.delete(peerId);
      broadcastToPeers({
        type: "peer-left",
        peerId,
      });
    });
  });

  console.log(`[Signaling] Server listening on port ${port}`);

  return {
    close() {
      wss.close();
    },
    getPeerCount() {
      return peers.size;
    },
  };
}
