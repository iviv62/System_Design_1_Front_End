import { VoiceCallAdapter, P2PScreenShare, type VoiceAnswer, type VoiceOffer, type ScreenSignalSender } from "./voice-call-adapter";
import { getApiBaseUrl } from "./chat-config";
import { fetchWithAuth } from "../http/fetch-interceptor";

export type VoiceCallState = "idle" | "calling" | "active" | "error";

export type VoiceCallControllerOptions = {
  apiBase: string | undefined;
  wsBase: string | undefined;
  room: string;
  username: string;
  onStateChange: (state: VoiceCallState) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onParticipantsChange?: (participants: { peer_id: string; username: string }[]) => void;
  /** Emits the active screen share stream (or null when it ends). */
  onScreenShareStream?: (stream: MediaStream | null) => void;
};

/**
 * Orchestrates a WebRTC voice call:
 * - Audio: server-offer SFU via aiortc (VoiceCallAdapter)
 * - Screen share: pure P2P WebRTC relay via WebSocket (P2PScreenShare)
 */
export class VoiceCallController {
  private adapter = new VoiceCallAdapter();
  private screenShare = new P2PScreenShare();
  private peerId: string | null = null;
  private currentRoom: string;
  private currentUsername: string;
  private currentParticipants: { peer_id: string; username: string }[] = [];
  private starting = false;
  private stopPromise: Promise<void> | null = null;
  private readonly options: VoiceCallControllerOptions;

  // Injected by chat-room.ts so the controller can send WS screen signaling
  private sendSignal: ScreenSignalSender = () => {};

  constructor(options: VoiceCallControllerOptions) {
    this.options = options;
    this.currentRoom = options.room;
    this.currentUsername = options.username;
  }

  get isScreenSharing(): boolean { return this.screenShare.isSharing; }

  /** Wire up the WS signaling sender (called once from chat-room.ts). */
  setSignalSender(sender: ScreenSignalSender): void {
    this.sendSignal = sender;
  }

  updateIdentity(room: string, username: string): void {
    this.currentRoom = room;
    this.currentUsername = username;
  }

  async handleRemoteIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.adapter.addIceCandidate(candidate);
  }

  /**
   * Join a voice call — server-offer flow:
   * 1. POST /voice/join → server returns SDP offer + peer_id
   * 2. Apply offer locally, create SDP answer
   * 3. POST /voice/answer
   */
  async start(): Promise<void> {
    this.stopPromise = null;
    if (this.peerId || this.starting) return;
    this.starting = true;
    this.options.onStateChange("calling");

    try {
      await this.adapter.openConnection({ onIceCandidate: this.options.onIceCandidate });

      const base = getApiBaseUrl(this.options.apiBase, this.options.wsBase);

      const joinRes = await fetchWithAuth(`${base}/voice/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: this.currentRoom, username: this.currentUsername }),
      });
      if (!joinRes.ok) throw new Error(`Join rejected: ${joinRes.status}`);

      const joinData: VoiceAnswer = await joinRes.json();
      this.peerId = joinData.peer_id;

      const answer = await this.adapter.applyOffer(joinData.sdp, joinData.type);

      const answerRes = await fetchWithAuth(`${base}/voice/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peer_id: this.peerId, sdp: answer.sdp, type: answer.type }),
      });
      if (!answerRes.ok) throw new Error(`Answer rejected: ${answerRes.status}`);

      const participants = joinData.participants ?? [];
      if (!participants.some(p => p.username === this.currentUsername)) {
        participants.unshift({ peer_id: this.peerId, username: this.currentUsername });
      }
      this.currentParticipants = participants;
      this.options.onParticipantsChange?.(participants);

      this.adapter.onConnectionFailed(() => void this.stop());
      this.options.onStateChange("active");
    } catch (err) {
      console.error("[VoiceCallController] start failed", err);
      this.adapter.close();
      this.options.onStateChange("error");
    } finally {
      this.starting = false;
    }
  }

  /** Handle a server-pushed renegotiation offer. Returns the answer. */
  async handleServerOffer(sdp: string, sdpType: RTCSdpType): Promise<VoiceOffer> {
    return this.adapter.applyOffer(sdp, sdpType);
  }

  // ── Participants tracking ─────────────────────────────────────────────────

  updateParticipants(participants: { peer_id: string; username: string }[]): void {
    this.currentParticipants = participants;
  }

  // ── Screen share ───────────────────────────────────────────────────────────

  async startScreenShare(): Promise<void> {
    if (!this.peerId) return;
    if (this.screenShare.isSharing) return;

    const observers = this.currentParticipants
      .map(p => p.peer_id)
      .filter(id => id !== this.peerId);

    try {
      const stream = await this.screenShare.start(
        observers,
        this.sendSignal,
        this.peerId,
        () => {
          // OS stopped the track — treat as explicit stop
          this.screenShare.stop(this.peerId!, this.sendSignal, this.currentRoom);
          this.options.onScreenShareStream?.(null);
        },
      );

      // Announce to room via WS
      this.sendSignal("screen_share_start", null, { room: this.currentRoom });
      this.options.onScreenShareStream?.(stream);
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") return;
      console.error("[VoiceCallController] startScreenShare failed", err);
      this.screenShare.closeAll();
    }
  }

  async stopScreenShare(): Promise<void> {
    if (!this.peerId || !this.screenShare.isSharing) return;
    this.screenShare.stop(this.peerId, this.sendSignal, this.currentRoom);
    this.options.onScreenShareStream?.(null);
  }

  /** Called when a new peer joins while we are sharing — open a P2P PC to them. */
  async handleLateJoiner(newPeerId: string): Promise<void> {
    if (!this.peerId || !this.screenShare.isSharing) return;
    await this.screenShare.openToLateJoiner(newPeerId, this.sendSignal, this.peerId)
      .catch(err => console.error("[VoiceCallController] late joiner share failed", err));
  }

  /** Observer: incoming screen_offer from sharer. */
  async handleScreenOffer(fromPeerId: string, sdp: string): Promise<void> {
    if (!this.peerId) return;
    await this.screenShare.handleOffer(
      fromPeerId,
      sdp,
      this.sendSignal,
      this.peerId,
      (stream) => this.options.onScreenShareStream?.(stream),
      () => this.options.onScreenShareStream?.(null),
    );
  }

  /** Sharer: incoming screen_answer from an observer. */
  async handleScreenAnswer(fromPeerId: string, sdp: string): Promise<void> {
    await this.screenShare.handleAnswer(fromPeerId, sdp);
  }

  /** Route an incoming screen_ice candidate. */
  async handleScreenIce(fromPeerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    await this.screenShare.handleIce(fromPeerId, candidate);
  }

  async stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;

    this.stopPromise = (async () => {
      const peerId = this.peerId;
      this.peerId = null;
      this.starting = false;
      this.screenShare.closeAll();
      this.adapter.close();
      this.options.onStateChange("idle");
      this.options.onParticipantsChange?.([]);

      if (peerId) {
        const base = getApiBaseUrl(this.options.apiBase, this.options.wsBase);
        await fetchWithAuth(`${base}/voice/stop/${peerId}`, { method: "POST" })
          .catch(err => console.error("Failed to notify backend of call end:", err));
      }
    })();

    await this.stopPromise;
  }

  setMuted(muted: boolean): void { this.adapter.setMuted(muted); }
  setVolume(volume: number): void { this.adapter.setVolume(volume); }
}
