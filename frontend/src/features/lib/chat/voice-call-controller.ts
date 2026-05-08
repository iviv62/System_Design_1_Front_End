import { VoiceCallAdapter, type VoiceAnswer, type VoiceOffer } from "./voice-call-adapter";
import { getApiBaseUrl } from "./chat-config";
import { fetchWithAuth } from "../http/fetch-interceptor";

/** Lifecycle state of a voice call. */
export type VoiceCallState = "idle" | "calling" | "active" | "error";

export type VoiceCallControllerOptions = {
  apiBase: string | undefined;
  wsBase: string | undefined;
  room: string;
  username: string;
  onStateChange: (state: VoiceCallState) => void;
  /** Called when a new local ICE candidate must be forwarded to the remote peer via WS signaling. */
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  /** Called with the full participant list after joining, and whenever it changes. */
  onParticipantsChange?: (participants: { peer_id: string; username: string }[]) => void;
  onScreenShareTrack?: (stream: MediaStream | null) => void;
};

/**
 * Orchestrates a WebRTC voice call: SDP offer/answer exchange with the server,
 * ICE candidate handling, participant list seeding, and clean teardown.
 */
export class VoiceCallController {
  private adapter = new VoiceCallAdapter();
  private peerId: string | null = null;
  private currentRoom: string;
  private currentUsername: string;
  /** Guards against concurrent start() calls during the async offer/answer phase. */
  private starting = false;
  private screenShareInProgress = false;
  private pendingStopScreenShare = false;
  /** Shared promise so concurrent stop() calls (user click + ICE failure) run teardown only once. */
  private stopPromise: Promise<void> | null = null;
  private readonly options: VoiceCallControllerOptions;

  constructor(options: VoiceCallControllerOptions) {
    this.options = options;
    this.currentRoom = options.room;
    this.currentUsername = options.username;
  }

  get isScreenSharing(): boolean {
    return this.adapter.isScreenSharing;
  }

  /**
   * Feeds an ICE candidate received from the remote peer via WS signaling
   * into the local RTCPeerConnection.
   */
  async handleRemoteIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.adapter.addIceCandidate(candidate);
  }

  /**
   * Updates room and username in-place when the user switches chat rooms,
   * so subsequent start() calls use the correct identity.
   */
  updateIdentity(room: string, username: string): void {
    this.currentRoom = room;
    this.currentUsername = username;
  }

  /**
   * Initiates a voice call. No-ops if a call is already starting or active.
   *
   * 1. Opens the RTCPeerConnection and registers the ICE candidate callback.
   * 2. Creates a local SDP offer and POSTs it to `/voice/offer`.
   * 3. Applies the server's SDP answer to complete the WebRTC handshake.
   * 4. Seeds the participant list, prepending self if the server omitted the caller.
   * 5. Registers an auto-stop handler for ICE connection failures.
   *
   * On any failure, closes the connection and transitions state to `"error"`.
   */
  async start(): Promise<void> {
    this.stopPromise = null;
    if (this.peerId || this.starting) return;
    this.starting = true;
    this.options.onStateChange("calling");

    try {
      await this.adapter.openConnection({
        onIceCandidate: this.options.onIceCandidate,
        onScreenShareTrack: this.options.onScreenShareTrack,
      });
      const offer = await this.adapter.createOffer();

      const base = getApiBaseUrl(this.options.apiBase, this.options.wsBase);
      const res = await fetchWithAuth(`${base}/voice/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...offer,
          room: this.currentRoom,
          username: this.currentUsername,
        }),
      });

      if (!res.ok) throw new Error(`Offer rejected: ${res.status}`);

      const answer: VoiceAnswer = await res.json();
      this.peerId = answer.peer_id;

      await this.adapter.applyAnswer(answer);

      // Prepend self if missing — the server's peer_joined broadcast excludes the joining user,
      // so the caller must add themselves from the HTTP response instead of waiting for a WS event.
      const participants = answer.participants ?? [];
      if (!participants.some(p => p.username === this.currentUsername)) {
        participants.unshift({ peer_id: this.peerId, username: this.currentUsername });
      }
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

  async startScreenShare(): Promise<void> {
    if (!this.peerId) {
      throw new Error("Voice call is not active.");
    }
    if (this.screenShareInProgress) return;
    if (this.adapter.isScreenSharing) return;

    try {
      this.screenShareInProgress = true;

      let offer: VoiceOffer;
      try {
        offer = await this.adapter.startScreenShare();
      } catch (err) {
        this.adapter.abortScreenShare();
        if (err instanceof Error && err.name !== "NotAllowedError") {
          console.error("[VoiceCallController] screen capture failed", err);
        }
        return;
      }

      try {
        await this.renegotiate(offer);
        this.options.onScreenShareTrack?.(this.adapter.getScreenStream());
      } catch (err) {
        console.error("[VoiceCallController] renegotiation failed, reverting", err);
        this.adapter.abortScreenShare();

        try {
          const restoreOffer = await this.adapter.createOffer();
          await this.renegotiate(restoreOffer);
        } catch {
          void this.stop();
        }
      }
    } finally {
      this.screenShareInProgress = false;
      if (this.pendingStopScreenShare) {
        this.pendingStopScreenShare = false;
        void this.stopScreenShare();
      }
    }
  }

  async stopScreenShare(): Promise<void> {
    if (!this.peerId) {
      return;
    }
    if (!this.adapter.isScreenSharing) return;

    if (this.screenShareInProgress) {
      this.pendingStopScreenShare = true;
      return;
    }

    this.screenShareInProgress = true;

    try {
      const offer = await this.adapter.stopScreenShare();
      this.options.onScreenShareTrack?.(null);

      try {
        await this.renegotiate(offer);
      } catch (err) {
        console.error("[VoiceCallController] stop screen share renegotiation failed", err);
        void this.stop();
      }
    } finally {
      this.screenShareInProgress = false;
    }
  }

  /**
   * Ends the active call and cleans up all resources.
   * Closes the RTCPeerConnection, transitions state to `"idle"`, and notifies
   * the server via `POST /voice/stop/:peerId` so it can broadcast `call_ended`
   * to the room. Idempotent — concurrent calls share one teardown promise.
   */
  async stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;

    this.stopPromise = (async () => {
      const peerId = this.peerId;
      this.peerId = null;
      this.screenShareInProgress = false;
      this.pendingStopScreenShare = false;
      this.adapter.close();
      this.options.onStateChange("idle");
      this.options.onParticipantsChange?.([]);

      if (peerId) {
        const base = getApiBaseUrl(this.options.apiBase, this.options.wsBase);
        await fetchWithAuth(`${base}/voice/stop/${peerId}`, { method: "POST" }).catch((err) => {
          console.error("Failed to notify backend of call end:", err);
        });
      }
    })();

    await this.stopPromise;
  }

  setMuted(muted: boolean): void {
    this.adapter.setMuted(muted);
  }

  setVolume(volume: number): void {
    this.adapter.setVolume(volume);
  }

  private async renegotiate(offer: VoiceOffer): Promise<void> {
    if (!this.peerId) return;

    this.adapter.resetRemoteDescriptionState();

    const base = getApiBaseUrl(this.options.apiBase, this.options.wsBase);
    const res = await fetchWithAuth(`${base}/voice/offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...offer,
        room: this.currentRoom,
        username: this.currentUsername,
        peer_id: this.peerId,
        is_renegotiation: true,
      }),
    });

    if (!res.ok) throw new Error(`Renegotiation rejected: ${res.status}`);

    const answer: VoiceAnswer = await res.json();
    await this.adapter.applyAnswer(answer);
  }
}