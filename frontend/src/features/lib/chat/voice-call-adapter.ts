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
  | { kind: "screen_share_stopped"; peerId: string; username: string; room: string };

// ── Extractor (same pattern as extractPresenceUpdate / extractReactionUpdate) ──
export function extractVoiceEvent(payload: unknown): VoiceEvent | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (p["type"] !== "voice") return null;

  const event = String(p["event"] ?? "");
  const peerId = String(p["peer_id"] ?? "");
  const username = String(p["username"] ?? "");
  const room = String(p["room"] ?? "");

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
    return {
      kind: "ice_candidate",
      peerId,
      room,
      candidate: p["candidate"] as RTCIceCandidateInit,
    };
  } else if (event === "screen_share_started" || event === "screen_share_stopped") {
    return {
      kind: event,
      peerId,
      username,
      room,
    };
  }

  return null;
}

// ── WebRTC adapter — wraps RTCPeerConnection lifecycle ────────────────────
export type VoiceCallAdapterOptions = {
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onScreenShareTrack?: (stream: MediaStream | null) => void;
};

export class VoiceCallAdapter {
  private pc: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private iceQueue: RTCIceCandidateInit[] = [];
  private isRemoteDescriptionSet = false;
  private options?: VoiceCallAdapterOptions;
  private videoTransceiver: RTCRtpTransceiver | null = null;
  private screenSender: RTCRtpSender | null = null;

  get isScreenSharing(): boolean {
    return this.screenSender !== null;
  }

  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  resetRemoteDescriptionState(): void {
    this.isRemoteDescriptionSet = false;
  }

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
    if (!audioTrack) {
      throw new Error("Microphone stream does not contain an audio track.");
    }

    this.pc.addTransceiver(audioTrack, { direction: "sendrecv" });
    this.videoTransceiver = this.pc.addTransceiver("video", { direction: "recvonly" });

    this.pc.ontrack = (event: RTCTrackEvent) => {
      if (event.track.kind === "video") {
        const videoStream = new MediaStream([event.track]);
        const emitAttached = () => this.options?.onScreenShareTrack?.(videoStream);
        const emitDetached = () => this.options?.onScreenShareTrack?.(null);

        emitAttached();
        event.track.onunmute = emitAttached;
        event.track.onmute = emitDetached;
        event.track.onended = () => {
          emitDetached();
        };
        return;
      }

      const audioStreams = event.streams.length > 0 ? event.streams : [new MediaStream([event.track])];

      for (const stream of audioStreams) {
        if (document.querySelector(`audio[data-stream="${stream.id}"]`)) continue;

        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.dataset["stream"] = stream.id;
        audio.srcObject = stream;
        audio.style.display = "none";
        document.body.appendChild(audio);

        stream.getAudioTracks().forEach((track) => {
          track.onended = () => audio.remove();
        });
      }
    };

    this.pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        this.options?.onIceCandidate?.(event.candidate.toJSON());
      }
    };

  }

  async createOffer(): Promise<VoiceOffer> {
    if (!this.pc) throw new Error("Peer connection is not initialized.");

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    const localDescription = this.pc.localDescription;
    if (!localDescription?.sdp) {
      throw new Error("Local description was not created.");
    }

    return {
      sdp: localDescription.sdp,
      type: localDescription.type,
    };
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
    if (!this.pc) return;

    if (!this.isRemoteDescriptionSet) {
      this.iceQueue.push(candidate);
      return;
    }

    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  async startScreenShare(): Promise<VoiceOffer> {
    if (!this.pc || !this.videoTransceiver) {
      throw new Error("Peer connection is not initialized.");
    }

    this.screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    const videoTrack = this.screenStream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error("Screen share stream does not contain a video track.");
    }

    this.videoTransceiver.direction = "sendrecv";
    await this.videoTransceiver.sender.replaceTrack(videoTrack);
    this.screenSender = this.videoTransceiver.sender;

    videoTrack.onended = () => {
      void this.stopScreenShare().catch((error) => {
        console.error("Failed to stop screen share after track end", error);
      });
    };

    return this.createOffer();
  }

  async stopScreenShare(): Promise<VoiceOffer> {
    if (!this.pc || !this.videoTransceiver) {
      throw new Error("Peer connection is not initialized.");
    }

    this.screenStream?.getTracks().forEach((track) => track.stop());
    this.screenStream = null;

    await this.videoTransceiver.sender.replaceTrack(null);
    this.videoTransceiver.direction = "recvonly";
    this.screenSender = null;

    return this.createOffer();
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
    for (const track of this.stream.getAudioTracks()) {
      track.enabled = !muted;
    }
  }

  setVolume(volume: number): void {
    document.querySelectorAll("audio[data-stream]").forEach((el) => {
      (el as HTMLAudioElement).volume = Math.max(0, Math.min(1, volume / 100));
    });
  }

  close(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.cleanupAudioElements();
    this.options?.onScreenShareTrack?.(null);
    this.stream = null;
    this.screenStream = null;
    this.pc = null;
    this.videoTransceiver = null;
    this.screenSender = null;
    this.options = undefined;
    this.iceQueue = [];
    this.isRemoteDescriptionSet = false;
  }

  private cleanupAudioElements(): void {
    document.querySelectorAll("audio[data-stream]").forEach((el) => el.remove());
  }
}
