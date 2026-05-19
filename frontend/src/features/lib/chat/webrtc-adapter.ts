import { ConnectionMonitor, type ConnectionMetrics } from "./connection-monitor";
import { fetchWithAuth } from "../http/fetch-interceptor";

// ── Shared types ─────────────────────────────────────────────────────────────
export interface Participant {
  peer_id: string;
  username: string;
}

export interface WebRTCAdapterConfig {
  baseUrl: string;
  wsBase: string;
  room: string;
  username: string;
}

export type VoiceCallState = "idle" | "calling" | "active" | "error";

export type WebRTCAdapterEvents = {
  onStatusChange?: (status: "disconnected" | "connected" | "error", message?: string) => void;
  onCallStateChange?: (state: "idle" | "calling" | "active" | "error") => void;
  onParticipantsChange?: (participants: Participant[]) => void;
  /**
   * Fired when a remote audio track arrives.
   * `safeStream` is a new MediaStream wrapping only this track — safe to set
   * as `<audio>.srcObject` directly without cross-browser quirks.
   * The UI layer is responsible for creating, mounting, and destroying the
   * <audio> element. Use `track.id` as a stable key.
   */
  onAudioTrack?: (track: MediaStreamTrack, safeStream: MediaStream) => void;
  /**
   * Fired when the call ends (teardown). The UI layer should remove all
   * <audio> elements it created via onAudioTrack.
   */
  onAudioTracksCleared?: () => void;
  /**
   * Fired when the user changes the volume slider. The UI layer should apply
   * the new volume (0-100) to all active <audio> elements.
   */
  onVolumeChange?: (volume: number) => void;
  onScreenShareStarted?: (stream: MediaStream | null, sharerName: string, isLocal: boolean) => void;
  onScreenShareStopped?: () => void;
  onSystemNotice?: (text: string) => void;
  onVoiceSignal?: (payload: Record<string, unknown>) => void;
  onConnectionMetrics?: (metrics: ConnectionMetrics) => void;
};

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

/**
 * Unified WebRTC adapter — owns:
 *  - The main audio SFU RTCPeerConnection (server-offer flow)
 *  - P2P screen-share mesh (client-offer, WS-relayed signaling)
 *  - Participant state tracking
 *
 * The adapter is intentionally DOM-free. All audio element lifecycle
 * (create, mount, volume, destroy) is delegated to the UI layer via events.
 *
 * The WS connection itself stays in ChatRoomController for chat/presence;
 * this adapter receives already-parsed voice events via handleVoiceEvent()
 * and sends WS voice signals back via the onVoiceSignal callback.
 */
export class WebRTCAdapter {
  // ── Main audio PC ───────────────────────────────────────────────────────────
  private pc: RTCPeerConnection | null = null;
  private micStream: MediaStream | null = null;
  private monitor: ConnectionMonitor | null = null;
  private isMonitorEnabled = false;

  // ── Identity ────────────────────────────────────────────────────────────────
  private myPeerId: string | null = null;
  private _room: string;
  private _username: string;

  // ── Participants ────────────────────────────────────────────────────────────
  private currentParticipants: Participant[] = [];

  // ── Screen share (P2P mesh) ─────────────────────────────────────────────────
  private screenStream: MediaStream | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private sharePcs = new Map<string, RTCPeerConnection>(); // outgoing, one per observer
  private incomingSharePc: RTCPeerConnection | null = null; // observer side
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  /** Peer ID of the remote participant currently sharing their screen (null when idle). */
  private _currentSharerPeerId: string | null = null;
  private currentSharerName: string | null = null;

  // ── State ───────────────────────────────────────────────────────────────────
  private callState: VoiceCallState = "idle";
  private _isMuted = false;

  private config: WebRTCAdapterConfig;
  private events: WebRTCAdapterEvents;

  constructor(config: WebRTCAdapterConfig, events: WebRTCAdapterEvents = {}) {
    this.config = config;
    this.events = events;
    this._room = config.room;
    this._username = config.username;
  }

  // ── Public getters ───────────────────────────────────────────────────────────

  get isScreenSharing(): boolean {
    return this.screenTrack !== null && this.screenTrack.readyState !== "ended";
  }

  get peerId(): string | null {
    return this.myPeerId;
  }

  /** Peer ID of the remote participant whose screen is currently being received. */
  get sharerPeerId(): string | null {
    return this._currentSharerPeerId;
  }

  updateIdentity(room: string, username: string): void {
    this._room = room;
    this._username = username;
  }

  // ── Call: join ──────────────────────────────────────────────────────────────
  async joinCall(): Promise<void> {
    if (this.pc || this.callState === "calling" || this.callState === "active") return;
    this.setCallState("calling");

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micStream.getAudioTracks().forEach((t) => {
        t.enabled = !this._isMuted;
      });
    } catch {
      this.setCallState("error");
      throw new Error("Microphone access denied or unavailable.");
    }

    this.pc = this.createMainPc();
    this.micStream.getTracks().forEach((t) => this.pc!.addTrack(t, this.micStream!));

    try {
      // Server-offer flow: POST /voice/join → server returns offer + peer_id
      const joinRes = await fetchWithAuth(`${this.config.baseUrl}/voice/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: this._room, username: this._username }),
      });
      if (!joinRes.ok) throw new Error(`Join rejected: ${joinRes.status}`);
      const joinData = (await joinRes.json()) as {
        peer_id: string;
        sdp: string;
        type: RTCSdpType;
        participants?: Participant[];
      };

      this.myPeerId = joinData.peer_id;

      await this.pc.setRemoteDescription({ sdp: joinData.sdp, type: joinData.type });
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      const answerRes = await fetchWithAuth(`${this.config.baseUrl}/voice/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peer_id: this.myPeerId, sdp: answer.sdp, type: answer.type }),
      });
      if (!answerRes.ok) throw new Error(`Answer rejected: ${answerRes.status}`);

      // Notify WS that this peer is now registered
      this.sendSignal({
        type: "voice",
        event: "peer_registered",
        peer_id: this.myPeerId,
        room: this._room,
      });

      const participants = joinData.participants ?? [];
      this.setParticipants(participants);
      this.setCallState("active");
    } catch (err) {
      console.error("[WebRTCAdapter] joinCall failed", err);
      this.teardown();
      this.setCallState("error");
    }
  }

  // ── Call: leave ─────────────────────────────────────────────────────────────
  leaveCall(): void {
    if (this.myPeerId) {
      this.sendSignal({
        type: "voice",
        event: "leave_call",
        peer_id: this.myPeerId,
        room: this._room,
      });
    }
    this.teardown();
  }

  // ── Screen share: start ─────────────────────────────────────────────────────
  async startScreenShare(): Promise<void> {
    if (this.isScreenSharing || !this.myPeerId) return;

    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { max: 1920 }, height: { max: 1080 }, frameRate: { max: 30 } },
      } as DisplayMediaStreamOptions);
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") return;
      throw err;
    }

    const [track] = this.screenStream.getVideoTracks();
    if (!track) return;
    this.screenTrack = track;
    track.onended = () => this.stopScreenShare();

    const observerIds = this.currentParticipants.map((p) => p.peer_id).filter(Boolean);
    for (const id of observerIds) await this.openSharePcTo(id);

    this.sendSignal({
      type: "voice",
      event: "screen_share_start",
      peer_id: this.myPeerId,
      room: this._room,
    });
    this.events.onScreenShareStarted?.(this.screenStream, `${this._username} (you)`, true);
  }

  // ── Screen share: stop ──────────────────────────────────────────────────────
  stopScreenShare(): void {
    if (!this.screenTrack && !this.screenStream) return;
    this.screenTrack?.stop();
    this.screenTrack = null;
    this.screenStream = null;
    for (const spc of this.sharePcs.values()) spc.close();
    this.sharePcs.clear();
    if (this.myPeerId) {
      this.sendSignal({
        type: "voice",
        event: "screen_share_stop",
        peer_id: this.myPeerId,
        room: this._room,
      });
    }
    this.events.onScreenShareStopped?.();
  }

  // ── Handle server-pushed renegotiation offer ────────────────────────────────
  async handleServerOffer(sdp: string, sdpType: RTCSdpType): Promise<void> {
    if (!this.pc || !this.myPeerId) return;
    await this.pc.setRemoteDescription({ type: sdpType, sdp });
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await fetchWithAuth(`${this.config.baseUrl}/voice/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peer_id: this.myPeerId, sdp: answer.sdp, type: answer.type }),
    });
  }

  setMonitorEnabled(enabled: boolean): void {
    this.isMonitorEnabled = enabled;
    if (!this.pc) return;

    if (enabled) {
      if (!this.monitor) {
        this.monitor = new ConnectionMonitor(this.pc);
      }
      this.monitor.startMonitoring((metrics) => {
        this.events.onConnectionMetrics?.(metrics);
      });
    } else {
      this.monitor?.stopMonitoring();
      this.monitor = null;
    }
  }

  // ── Main entry point: route parsed WS voice events ─────────────────────────
  handleVoiceEvent(msg: Record<string, unknown>): void {
    const event = String(msg["event"] ?? "");

    switch (event) {
      case "call_started": {
        const participants = (msg["participants"] as Participant[] | undefined) ?? [];
        this.setParticipants(participants);
        this.events.onSystemNotice?.(`${msg["username"]} started a voice call`);
        break;
      }
      case "peer_joined": {
        const participants = (msg["participants"] as Participant[] | undefined) ?? [];
        this.setParticipants(participants);
        this.events.onSystemNotice?.(`${msg["username"]} joined the voice call`);
        // Late-joiner mesh: open a share PC to them if we are already sharing
        const newPeerId = String(msg["peer_id"] ?? "");
        if (this.isScreenSharing && newPeerId && newPeerId !== this.myPeerId) {
          this.openSharePcTo(newPeerId).catch((err) =>
            console.error("[WebRTCAdapter] late joiner screen share failed", err),
          );
        }
        break;
      }
      case "peer_left": {
        const participants = (msg["participants"] as Participant[] | undefined) ?? [];
        this.setParticipants(participants);
        this.events.onSystemNotice?.(`${msg["username"]} left the voice call`);
        // Clean up any outgoing share PC to that peer
        const leftPeerId = String(msg["peer_id"] ?? "");
        const spc = this.sharePcs.get(leftPeerId);
        if (spc) {
          spc.close();
          this.sharePcs.delete(leftPeerId);
        }
        break;
      }
      case "call_ended": {
        this.events.onSystemNotice?.(`${msg["username"]} ended the call`);
        this.teardown();
        break;
      }
      case "server_offer": {
        const sdp = String(msg["sdp"] ?? "");
        const sdpType = (msg["sdp_type"] as RTCSdpType) ?? "offer";
        this.handleServerOffer(sdp, sdpType).catch((err) =>
          console.error("[WebRTCAdapter] server_offer failed", err),
        );
        break;
      }
      case "screen_share_started": {
        const sharerPeerId = String(msg["peer_id"] ?? "");
        if (sharerPeerId !== this.myPeerId) {
          this._currentSharerPeerId = sharerPeerId;
          this.currentSharerName = String(msg["username"] ?? "");
          this.events.onScreenShareStarted?.(null, this.currentSharerName, false);
          this.events.onSystemNotice?.(`${msg["username"]} started sharing their screen`);
        }
        break;
      }
      case "screen_share_stopped": {
        const stoppedName = String(msg["username"] ?? "");
        this._currentSharerPeerId = null;
        this.currentSharerName = null;
        this.incomingSharePc?.close();
        this.incomingSharePc = null;
        this.pendingIceCandidates = [];
        this.events.onScreenShareStopped?.();
        this.events.onSystemNotice?.(`${stoppedName} stopped sharing their screen`);
        break;
      }
      case "screen_offer":
        this.handleScreenOffer(msg).catch((err) =>
          console.error("[WebRTCAdapter] screen_offer error", err),
        );
        break;
      case "screen_answer":
        this.handleScreenAnswer(msg).catch((err) =>
          console.error("[WebRTCAdapter] screen_answer error", err),
        );
        break;
      case "screen_ice":
        this.handleScreenIce(msg).catch((err) =>
          console.error("[WebRTCAdapter] screen_ice error", err),
        );
        break;
    }
  }

  // ── Mute ────────────────────────────────────────────────────────────────────
  setMuted(muted: boolean): void {
    this._isMuted = muted;
    this.micStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }

  /**
   * Notify the UI layer to update volume on all active audio elements.
   * Volume control is intentionally delegated — the adapter holds no references
   * to DOM elements.
   */
  setVolume(volume: number): void {
    this.events.onVolumeChange?.(volume);
  }

  // ── Full teardown ───────────────────────────────────────────────────────────
  destroy(): void {
    this.teardown();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private setCallState(state: VoiceCallState): void {
    this.callState = state;
    this.events.onCallStateChange?.(state);
  }

  private setParticipants(list: Participant[]): void {
    this.currentParticipants = list;
    this.events.onParticipantsChange?.(list);
  }

  private sendSignal(payload: Record<string, unknown>): void {
    this.events.onVoiceSignal?.(payload);
  }

  private teardown(): void {
    // Screen share
    this.screenTrack?.stop();
    this.screenTrack = null;
    this.screenStream = null;
    for (const spc of this.sharePcs.values()) spc.close();
    this.sharePcs.clear();
    this.incomingSharePc?.close();
    this.incomingSharePc = null;
    this.pendingIceCandidates = [];
    this._currentSharerPeerId = null;
    this.currentSharerName = null;

    // Main audio PC
    this.monitor?.stopMonitoring();
    this.monitor = null;
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    this.pc?.close();
    this.pc = null;

    // Notify the UI layer to clean up all audio elements it owns
    this.events.onAudioTracksCleared?.();

    this.myPeerId = null;
    this.setParticipants([]);
    this.setCallState("idle");
    this.events.onScreenShareStopped?.();
  }

  private createMainPc(): RTCPeerConnection {
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    if (this.isMonitorEnabled) {
      this.monitor = new ConnectionMonitor(peer);
      this.monitor.startMonitoring((metrics) => {
        this.events.onConnectionMetrics?.(metrics);
      });
    }

    peer.ontrack = ({ track }) => {
      if (track.kind !== "audio") return;
      // Wrap in a single-track stream — this is the safe cross-browser pattern.
      // The UI layer receives this and owns the <audio> element lifecycle.
      const safeStream = new MediaStream([track]);
      this.events.onAudioTrack?.(track, safeStream);
    };

    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === "failed" || peer.iceConnectionState === "closed") {
        this.teardown();
      }
    };

    return peer;
  }

  // ── P2P screen share: sharer side ──────────────────────────────────────────
  private async openSharePcTo(observerPeerId: string): Promise<void> {
    if (!this.screenTrack || !this.screenStream) return;
    const spc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.sharePcs.set(observerPeerId, spc);

    spc.addTrack(this.screenTrack, this.screenStream);

    spc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.sendSignal({
          type: "voice",
          event: "screen_ice",
          peer_id: this.myPeerId,
          to: observerPeerId,
          candidate: candidate.toJSON(),
        });
      }
    };

    const offer = await spc.createOffer();
    await spc.setLocalDescription(offer);
    this.sendSignal({
      type: "voice",
      event: "screen_offer",
      peer_id: this.myPeerId,
      to: observerPeerId,
      sdp: offer.sdp,
    });
  }

  // ── P2P screen share: observer side ────────────────────────────────────────
  private async handleScreenOffer(msg: Record<string, unknown>): Promise<void> {
    const from = String(msg["from"] ?? msg["peer_id"] ?? "");
    const sdp = String(msg["sdp"] ?? "");
    this._currentSharerPeerId = from;
    this.currentSharerName = String(msg["username"] ?? this.currentSharerName ?? "");

    this.pendingIceCandidates = [];
    this.incomingSharePc?.close();
    this.incomingSharePc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.incomingSharePc.ontrack = ({ track, streams }) => {
      const stream = streams[0] ?? new MediaStream([track]);
      this.events.onScreenShareStarted?.(stream, this.currentSharerName ?? "remote", false);
      track.onended = () => this.events.onScreenShareStopped?.();
    };

    this.incomingSharePc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.sendSignal({
          type: "voice",
          event: "screen_ice",
          peer_id: this.myPeerId,
          to: from,
          candidate: candidate.toJSON(),
        });
      }
    };

    await this.incomingSharePc.setRemoteDescription({ type: "offer", sdp });

    for (const c of this.pendingIceCandidates) {
      await this.incomingSharePc.addIceCandidate(c).catch(() => {});
    }
    this.pendingIceCandidates = [];

    const answer = await this.incomingSharePc.createAnswer();
    await this.incomingSharePc.setLocalDescription(answer);
    this.sendSignal({
      type: "voice",
      event: "screen_answer",
      peer_id: this.myPeerId,
      to: from,
      sdp: answer.sdp,
    });
  }

  private async handleScreenAnswer(msg: Record<string, unknown>): Promise<void> {
    const from = String(msg["from"] ?? msg["peer_id"] ?? "");
    const sdp = String(msg["sdp"] ?? "");
    const spc = this.sharePcs.get(from);
    if (spc) await spc.setRemoteDescription({ type: "answer", sdp });
  }

  private async handleScreenIce(msg: Record<string, unknown>): Promise<void> {
    const from = String(msg["from"] ?? msg["peer_id"] ?? "");
    const candidate = msg["candidate"] as RTCIceCandidateInit | undefined;
    if (!candidate) return;

    const outgoing = this.sharePcs.get(from);
    if (outgoing) {
      await outgoing.addIceCandidate(candidate).catch(() => {});
      return;
    }
    if (this.incomingSharePc) {
      if (!this.incomingSharePc.remoteDescription) {
        this.pendingIceCandidates.push(candidate);
        return;
      }
      await this.incomingSharePc.addIceCandidate(candidate).catch(() => {});
    }
  }
}
