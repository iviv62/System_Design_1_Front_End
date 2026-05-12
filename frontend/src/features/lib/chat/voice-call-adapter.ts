export type VoiceOffer = { sdp: string; type: RTCSdpType };
export type VoiceAnswer = { peer_id: string; sdp: string; type: RTCSdpType; participants?: { peer_id: string; username: string }[] };

// ── Domain type: the only shape the rest of the app sees ──────────────────
export type VoiceEvent =
  | { kind: "call_started"; peerId: string; username: string; room: string }
  | { kind: "call_ended"; peerId: string; username: string; room: string }
  | { kind: "call_error"; peerId: string; username: string; room: string }
  | { kind: "peer_joined"; peerId: string; username: string; room: string; participants: { peer_id: string; username: string }[] }
  | { kind: "ice_candidate"; peerId: string; room: string; candidate: RTCIceCandidateInit }
  | { kind: "screen_share_started"; peerId: string; username: string; room: string }
  | { kind: "screen_share_stopped"; peerId: string; username: string; room: string }
  | { kind: "server_offer"; peerId: string; room: string; sdp: string; sdpType: RTCSdpType }
  | { kind: "screen_offer"; fromPeerId: string; sdp: string; room: string }
  | { kind: "screen_answer"; fromPeerId: string; sdp: string; room: string }
  | { kind: "screen_ice"; fromPeerId: string; candidate: RTCIceCandidateInit; room: string };

// ── Extractor ──────────────────────────────────────────────────────────────
export function extractVoiceEvent(payload: unknown): VoiceEvent | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (p["type"] !== "voice") return null;

  const event = String(p["event"] ?? "");
  const peerId = String(p["peer_id"] ?? "");
  const username = String(p["username"] ?? "");
  const room = String(p["room"] ?? "");
  const from = String(p["from"] ?? "");

  if (event === "call_started" || event === "call_ended" || event === "call_error") {
    return { kind: event as "call_started" | "call_ended" | "call_error", peerId, username, room };
  } else if (event === "peer_joined") {
    return {
      kind: "peer_joined",
      peerId,
      username,
      room,
      participants: Array.isArray(p["participants"]) ? p["participants"] as { peer_id: string; username: string }[] : [],
    };
  } else if (event === "ice_candidate") {
    return { kind: "ice_candidate", peerId, room, candidate: p["candidate"] as RTCIceCandidateInit };
  } else if (event === "screen_share_started" || event === "screen_share_stopped") {
    return { kind: event, peerId, username, room };
  } else if (event === "server_offer") {
    return {
      kind: "server_offer",
      peerId,
      room,
      sdp: String(p["sdp"] ?? ""),
      sdpType: (p["sdp_type"] as RTCSdpType) ?? "offer",
    };
  } else if (event === "screen_offer") {
    return { kind: "screen_offer", fromPeerId: from || peerId, sdp: String(p["sdp"] ?? ""), room };
  } else if (event === "screen_answer") {
    return { kind: "screen_answer", fromPeerId: from || peerId, sdp: String(p["sdp"] ?? ""), room };
  } else if (event === "screen_ice") {
    return { kind: "screen_ice", fromPeerId: from || peerId, candidate: p["candidate"] as RTCIceCandidateInit, room };
  }

  return null;
}

// ── P2P screen share manager ───────────────────────────────────────────────
// Mirrors the test client's sharePcs / incomingSharePc pattern exactly.
// The SFU peer connection (VoiceCallAdapter) is never touched for screen share.

export type ScreenSignalSender = (event: string, to: string | null, payload: Record<string, unknown>) => void;

export class P2PScreenShare {
  private sharePcs = new Map<string, RTCPeerConnection>();   // outgoing: peerId → PC
  private incomingPc: RTCPeerConnection | null = null;        // incoming: single observer PC
  private pendingIce: RTCIceCandidateInit[] = [];             // buffered before remote desc
  private screenStream: MediaStream | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private onStop: (() => void) | null = null;

  get isSharing(): boolean { return this.screenTrack !== null && this.screenTrack.readyState !== "ended"; }
  getStream(): MediaStream | null { return this.screenStream; }

  /**
   * Start screen capture and open a P2P PC to every current participant.
   * @param observerPeerIds  list of peer_ids to send to (excluding self)
   * @param sendSignal       callback to send WS signaling messages
   * @param myPeerId         caller's own peer_id
   * @param onTrackEnded     called when the OS screen-share UI stops the track
   */
  async start(
    observerPeerIds: string[],
    sendSignal: ScreenSignalSender,
    myPeerId: string,
    onTrackEnded: () => void,
  ): Promise<MediaStream> {
    this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const [track] = this.screenStream.getVideoTracks();
    if (!track) throw new Error("No video track in screen stream.");
    this.screenTrack = track;
    this.onStop = onTrackEnded;

    track.onended = () => onTrackEnded();

    for (const peerId of observerPeerIds) {
      await this._openSharePcTo(peerId, sendSignal, myPeerId);
    }

    return this.screenStream;
  }

  /** Open a new P2P connection to a late joiner while already sharing. */
  async openToLateJoiner(
    observerPeerId: string,
    sendSignal: ScreenSignalSender,
    myPeerId: string,
  ): Promise<void> {
    if (!this.isSharing) return;
    await this._openSharePcTo(observerPeerId, sendSignal, myPeerId);
  }

  stop(myPeerId: string, sendSignal: ScreenSignalSender, room: string): void {
    this.screenTrack?.stop();
    this.screenTrack = null;
    this.screenStream = null;
    this.onStop = null;

    for (const pc of this.sharePcs.values()) pc.close();
    this.sharePcs.clear();

    sendSignal("screen_share_stop", null, { room });
  }

  /** Observer side: handle incoming screen_offer from sharer. */
  async handleOffer(
    fromPeerId: string,
    sdp: string,
    sendSignal: ScreenSignalSender,
    myPeerId: string,
    onStream: (stream: MediaStream) => void,
    onEnded: () => void,
  ): Promise<void> {
    this.pendingIce = [];
    this.incomingPc?.close();
    this.incomingPc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    this.incomingPc.ontrack = ({ track, streams }) => {
      const stream = streams[0] ?? new MediaStream([track]);
      onStream(stream);
      track.onended = () => onEnded();
    };

    this.incomingPc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sendSignal("screen_ice", fromPeerId, { candidate: candidate.toJSON() });
      }
    };

    await this.incomingPc.setRemoteDescription({ type: "offer", sdp });

    for (const c of this.pendingIce) {
      await this.incomingPc.addIceCandidate(c).catch(() => {});
    }
    this.pendingIce = [];

    const answer = await this.incomingPc.createAnswer();
    await this.incomingPc.setLocalDescription(answer);
    sendSignal("screen_answer", fromPeerId, { sdp: answer.sdp });
  }

  /** Sharer side: apply the observer's answer. */
  async handleAnswer(fromPeerId: string, sdp: string): Promise<void> {
    const pc = this.sharePcs.get(fromPeerId);
    if (!pc) return;
    await pc.setRemoteDescription({ type: "answer", sdp });
  }

  /** Route an incoming ICE candidate to the correct PC. */
  async handleIce(fromPeerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const outgoing = this.sharePcs.get(fromPeerId);
    if (outgoing) {
      await outgoing.addIceCandidate(candidate).catch(() => {});
      return;
    }
    if (this.incomingPc) {
      if (!this.incomingPc.remoteDescription) {
        this.pendingIce.push(candidate);
        return;
      }
      await this.incomingPc.addIceCandidate(candidate).catch(() => {});
    }
  }

  closeAll(): void {
    this.screenTrack?.stop();
    this.screenTrack = null;
    this.screenStream = null;
    this.onStop = null;
    for (const pc of this.sharePcs.values()) pc.close();
    this.sharePcs.clear();
    this.incomingPc?.close();
    this.incomingPc = null;
    this.pendingIce = [];
  }

  private async _openSharePcTo(
    observerPeerId: string,
    sendSignal: ScreenSignalSender,
    myPeerId: string,
  ): Promise<void> {
    if (!this.screenTrack || !this.screenStream) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    this.sharePcs.set(observerPeerId, pc);

    pc.addTrack(this.screenTrack, this.screenStream);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sendSignal("screen_ice", observerPeerId, { candidate: candidate.toJSON() });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal("screen_offer", observerPeerId, { sdp: offer.sdp });
  }
}

// ── Audio SFU adapter — wraps RTCPeerConnection lifecycle ──────────────────
export type VoiceCallAdapterOptions = {
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
};

export class VoiceCallAdapter {
  private pc: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;
  private iceQueue: RTCIceCandidateInit[] = [];
  private isRemoteDescriptionSet = false;
  private options?: VoiceCallAdapterOptions;

  async openConnection(options?: VoiceCallAdapterOptions): Promise<void> {
    this.options = options;
    this.cleanupAudioElements();
    this.iceQueue = [];
    this.isRemoteDescriptionSet = false;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
    } catch (error) {
      throw new Error("Microphone access denied or unavailable.", { cause: error });
    }

    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    const audioTrack = this.stream.getAudioTracks()[0];
    if (!audioTrack) throw new Error("Microphone stream does not contain an audio track.");

    this.pc.addTransceiver(audioTrack, { direction: "sendrecv" });

    this.pc.ontrack = (event: RTCTrackEvent) => {
      if (event.track.kind !== "audio") return;

      const audioStreams = event.streams.length > 0 ? event.streams : [new MediaStream([event.track])];
      for (const s of audioStreams) {
        if (document.querySelector(`audio[data-stream="${s.id}"]`)) continue;
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.dataset["stream"] = s.id;
        audio.srcObject = s;
        audio.style.display = "none";
        document.body.appendChild(audio);
        s.getAudioTracks().forEach((t) => { t.onended = () => audio.remove(); });
      }
    };

    this.pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) this.options?.onIceCandidate?.(event.candidate.toJSON());
    };
  }

  /** Apply a server-sent SDP offer and return an SDP answer. */
  async applyOffer(sdp: string, type: RTCSdpType): Promise<VoiceOffer> {
    if (!this.pc) throw new Error("Peer connection is not initialized.");
    this.isRemoteDescriptionSet = false;
    await this.pc.setRemoteDescription(new RTCSessionDescription({ sdp, type }));
    this.isRemoteDescriptionSet = true;

    for (const candidate of this.iceQueue) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    this.iceQueue = [];

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return { sdp: this.pc.localDescription!.sdp, type: this.pc.localDescription!.type };
  }

  async applyAnswer(answer: VoiceAnswer): Promise<void> {
    if (!this.pc) throw new Error("Peer connection is not initialized.");
    await this.pc.setRemoteDescription(answer as RTCSessionDescriptionInit);
    this.isRemoteDescriptionSet = true;
    for (const candidate of this.iceQueue) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    this.iceQueue = [];
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) {
      console.debug("[VoiceCallAdapter] ignoring ICE candidate after peer connection closed");
      return;
    }
    if (!this.isRemoteDescriptionSet) {
      this.iceQueue.push(candidate);
      return;
    }
    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  onConnectionFailed(cb: () => void): void {
    if (!this.pc) return;
    this.pc.onconnectionstatechange = () => {
      const s = this.pc?.connectionState;
      if (s === "failed" || s === "closed") cb();
    };
  }

  setMuted(muted: boolean): void {
    if (!this.stream) return;
    for (const track of this.stream.getAudioTracks()) track.enabled = !muted;
  }

  setVolume(volume: number): void {
    document.querySelectorAll("audio[data-stream]").forEach((el) => {
      (el as HTMLAudioElement).volume = Math.max(0, Math.min(1, volume / 100));
    });
  }

  close(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.cleanupAudioElements();
    this.stream = null;
    this.pc = null;
    this.options = undefined;
    this.iceQueue = [];
    this.isRemoteDescriptionSet = false;
  }

  private cleanupAudioElements(): void {
    document.querySelectorAll("audio[data-stream]").forEach((el) => el.remove());
  }
}
