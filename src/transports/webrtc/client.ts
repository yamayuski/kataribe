import { createClientRuntime } from "../../runtime.ts";
import type {
  ClientWithServerRpc,
  ContractShape,
  RpcToClientHandlerMap,
  RuntimeOptions,
} from "../../types.ts";
import { WebRTCDataChannelTransport } from "./transport.ts";

export interface WebRTCClientParams<C extends ContractShape> {
  contract: C;
  handlersForServerCalls?: RpcToClientHandlerMap<C>;
  runtime?: RuntimeOptions;
  signalingUrl: string;
  rtcConfiguration?: RTCConfiguration;
  dataChannelOptions?: RTCDataChannelInit;
  isInitiator?: boolean;
  targetPeerId?: string;
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

export async function createWebRTCClient<C extends ContractShape>(
  params: WebRTCClientParams<C>,
): Promise<ClientWithServerRpc<C>> {
  const {
    contract,
    handlersForServerCalls,
    runtime,
    signalingUrl,
    rtcConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    },
    dataChannelOptions = {
      ordered: true,
    },
    isInitiator = false,
    targetPeerId,
  } = params;

  return new Promise((resolve, reject) => {
    const peerConnection = new RTCPeerConnection(rtcConfiguration);
    const signalingSocket = new WebSocket(signalingUrl);
    let dataChannel: RTCDataChannel;
    let currentPeerId: string | undefined;
    let remotePeerId: string | undefined;

    // Set up data channel
    if (isInitiator) {
      dataChannel = peerConnection.createDataChannel(
        "kataribe",
        dataChannelOptions,
      );
      setupDataChannel();
    } else {
      peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel();
      };
    }

    function setupDataChannel() {
      dataChannel.onopen = () => {
        console.log("[WebRTC] Data channel opened");
        const transport = new WebRTCDataChannelTransport({
          dataChannel,
          peerConnection,
        });

        const client = createClientRuntime(
          transport,
          contract,
          handlersForServerCalls ?? ({} as RpcToClientHandlerMap<C>),
          runtime,
        );

        resolve(client);
      };

      dataChannel.onerror = (error) => {
        console.error("[WebRTC] Data channel error:", error);
        reject(error);
      };
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        signalingSocket.send(
          JSON.stringify({
            type: "ice-candidate",
            data: event.candidate,
            targetPeerId: remotePeerId,
          }),
        );
      }
    };

    // Handle signaling
    signalingSocket.onopen = () => {
      console.log("[WebRTC] Connected to signaling server");
    };

    signalingSocket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data) as SignalingMessage;

        switch (message.type) {
          case "join":
            currentPeerId = message.peerId;
            console.log(`[WebRTC] Assigned peer ID: ${currentPeerId}`);
            break;

          case "peer-joined":
            if (
              message.peerId &&
              isInitiator &&
              (!targetPeerId || message.peerId === targetPeerId)
            ) {
              // Initiate connection to new peer
              remotePeerId = message.peerId;
              console.log(
                `[WebRTC] Initiating connection to peer: ${remotePeerId}`,
              );

              const offer = await peerConnection.createOffer();
              await peerConnection.setLocalDescription(offer);

              signalingSocket.send(
                JSON.stringify({
                  type: "offer",
                  data: offer,
                  targetPeerId: remotePeerId,
                }),
              );
            }
            break;

          case "offer":
            if (message.data && message.peerId) {
              remotePeerId = message.peerId;
              console.log(`[WebRTC] Received offer from peer: ${remotePeerId}`);

              await peerConnection.setRemoteDescription(
                message.data as RTCSessionDescriptionInit,
              );
              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);

              signalingSocket.send(
                JSON.stringify({
                  type: "answer",
                  data: answer,
                  targetPeerId: remotePeerId,
                }),
              );
            }
            break;

          case "answer":
            if (message.data && message.peerId === remotePeerId) {
              console.log(
                `[WebRTC] Received answer from peer: ${remotePeerId}`,
              );
              await peerConnection.setRemoteDescription(
                message.data as RTCSessionDescriptionInit,
              );
            }
            break;

          case "ice-candidate":
            if (message.data && message.peerId === remotePeerId) {
              console.log(
                `[WebRTC] Received ICE candidate from peer: ${remotePeerId}`,
              );
              await peerConnection.addIceCandidate(
                message.data as RTCIceCandidateInit,
              );
            }
            break;

          case "peer-left":
            if (message.peerId === remotePeerId) {
              console.log(`[WebRTC] Peer ${remotePeerId} left`);
              peerConnection.close();
              signalingSocket.close();
            }
            break;
        }
      } catch (e) {
        console.error("[WebRTC] Failed to handle signaling message:", e);
      }
    };

    signalingSocket.onerror = (error) => {
      console.error("[WebRTC] Signaling socket error:", error);
      reject(error);
    };

    signalingSocket.onclose = () => {
      console.log("[WebRTC] Signaling socket closed");
    };

    // Cleanup on connection failure
    const timeout = setTimeout(() => {
      reject(new Error("WebRTC connection timeout"));
      peerConnection.close();
      signalingSocket.close();
    }, 30000); // 30 second timeout

    // Clear timeout when connection succeeds
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === "connected") {
        clearTimeout(timeout);
      } else if (peerConnection.connectionState === "failed") {
        clearTimeout(timeout);
        reject(new Error("WebRTC connection failed"));
      }
    };
  });
}
