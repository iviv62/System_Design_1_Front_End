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
  /**
   * ICE server configuration.
   * Pass STUN + TURN credentials from your backend for production use.
   * Falls back to Google's public STUN server if omitted (dev/test only).
   */
  iceServers?: RTCIceServer[];
}

export type VoiceCallState = "idle" | "calling" | "active" | "error";

export type WebRTCAdapterEvents = {
  onStatusChange?: (status: "disconnected" | "connected" | "error", message?: string) => void;
  onCallStateChange?: (state: "idle" | "calling" | "active" | "error") => void;
  onParticipantsChange?: (participants: Participant[]) => void;
  /**
   * Fired when a remote audio track arrives.
   * The UI layer is responsible for creating and managing the <audio> element.
   */
  onAudioTrack?: (track: MediaStreamTrack, streams: readonly MediaStream[]) => void;
  onScreenShareStarted?: (stream: MediaStream | null, sharerName: string, isLocal: boolean) => void;
  onScreenShareStopped?: () => void;
  onSystemNotice?: (text: string) => void;
  onVoiceSignal?: (payload: Record<string, unknown>) => void;
  onConnectionMetrics?: (metrics: ConnectionMetrics) => void;
};

/** Fallback STUN — for dev/test only. Pass iceServers via config in production. */
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

/**
 * Unified WebRTC adapter — owns:
 *  - The main audio SFU RTCPeerConnection (server-offer flow)
 *  - P2P screen-share mesh (client-offer, WS-relayed signaling)
 *  - Participant state tracking
 *
 * The WS connection itself stays in ChatRoomController for chat/presence;
 * this adapter receives already-parsed voice events via handleVoiceEvent()
 * and sends WS voice signals back via the onVoiceSignal callback.
 *
 * Audio element lifecycle is intentionally delegated to the UI layer via
 * onAudioTrack — this class makes no direct document.* calls.
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
    if (!track) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
      return;
    }
    this.screenTrack = track;
    track.onended = () => this.stopScreenShare();

    const observerIds = this.currentParticipants.map((p) => p.peer_id).filter(Boolean);

    // Open all peer connections concurrently — no head-of-line blocking.
    const results = await Promise.allSettled(observerIds.map((id) => this.openSharePcTo(id)));
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        console.warn(
          `[WebRTCAdapter] startScreenShare: failed to open share PC to peer ${observerIds[i]}`,
          result.reason,
        );
      }
    });

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
            console.warn("[WebRTCAdapter] late joiner screen share failed", err),
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

  // ── Mute / volume ───────────────────────────────────────────────────────────
  setMuted(muted: boolean): void {
    this._isMuted = muted;
    this.micStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }

  /**
   * Adjust playback volume for all remote audio tracks.
   * NOTE: The UI layer is responsible for maintaining references to the
   * <audio> elements it created in response to onAudioTrack. Pass a
   * setVolume callback in your component and store element refs there.
   * This method is kept as a convenience but requires the UI layer to
   * expose audio elements via a data attribute (data-webrtc-stream) if
   * you choose to use document queries — or better, call .volume directly
   * on the element refs held by the UI.
   */
  setVolume(volume: number): void {
    document.querySelectorAll<HTMLAudioElement>("audio[data-webrtc-stream]").forEach((el) => {
      el.volume = Math.max(0, Math.min(1, volume / 100));
    });
  }

  // ── Full teardown ───────────────────────────────────────────────────────────
  destroy(): void {
    this.teardown();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private get iceServers(): RTCIceServer[] {
    return this.config.iceServers ?? FALLBACK_ICE_SERVERS;
  }

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
    const wasScreenActive =
      this.isScreenSharing || this._currentSharerPeerId !== null;

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

    this.myPeerId = null;
    this.setParticipants([]);
    this.setCallState("idle");

    // Only notify the UI if a screen share was actually active,
    // to avoid spurious resets on normal call leave.
    if (wasScreenActive) {
      this.events.onScreenShareStopped?.();
    }
  }

  private createMainPc(): RTCPeerConnection {
    const peer = new RTCPeerConnection({ iceServers: this.iceServers });

    if (this.isMonitorEnabled) {
      this.monitor = new ConnectionMonitor(peer);
      this.monitor.startMonitoring((metrics) => {
        this.events.onConnectionMetrics?.(metrics);
      });
    }

    peer.ontrack = ({ track, streams }) => {
      if (track.kind !== "audio") return;
      // Delegate audio element creation entirely to the UI layer.
      this.events.onAudioTrack?.(track, streams);
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
    const spc = new RTCPeerConnection({ iceServers: this.iceServers });
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
    this.incomingSharePc = new RTCPeerConnection({ iceServers: this.iceServers });

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
      await this.incomingSharePc
        .addIceCandidate(c)
        .catch((err) => console.warn("[WebRTCAdapter] failed to add buffered ICE candidate", err));
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
      await outgoing
        .addIceCandidate(candidate)
        .catch((err) => console.warn("[WebRTCAdapter] outgoing ICE candidate failed", err));
      return;
    }
    if (this.incomingSharePc) {
      if (!this.incomingSharePc.remoteDescription) {
        this.pendingIceCandidates.push(candidate);
        return;
      }
      await this.incomingSharePc
        .addIceCandidate(candidate)
        .catch((err) => console.warn("[WebRTCAdapter] incoming ICE candidate failed", err));
    }
  }
}
