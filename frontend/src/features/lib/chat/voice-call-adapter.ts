export type VoiceOffer = { sdp: string; type: RTCSdpType };
export type VoiceAnswer = { peer_id: string; sdp: string; type: RTCSdpType };

// ── Domain type: the only shape the rest of the app sees ──────────────────
export type VoiceEvent = {
  kind: "call_started" | "call_ended" | "call_error";
  peerId: string;
  username: string;
  room: string;
};

// ── Extractor (same pattern as extractPresenceUpdate / extractReactionUpdate) ──
export function extractVoiceEvent(payload: unknown): VoiceEvent | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (p["type"] !== "voice") return null;

  const event = String(p["event"] ?? "");
  if (!["call_started", "call_ended", "call_error"].includes(event)) return null;

  return {
    kind: event as VoiceEvent["kind"],
    peerId: String(p["peer_id"] ?? ""),
    username: String(p["username"] ?? ""),
    room: String(p["room"] ?? ""),
  };
}

// ── WebRTC adapter — wraps RTCPeerConnection lifecycle ────────────────────
export class VoiceCallAdapter {
  private pc: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;

  async openConnection(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    for (const track of this.stream.getTracks()) {
      this.pc.addTrack(track, this.stream);
    }
  }

  async createOffer(): Promise<VoiceOffer> {
    const offer = await this.pc!.createOffer();
    await this.pc!.setLocalDescription(offer);
    return {
      sdp: this.pc!.localDescription!.sdp,
      type: this.pc!.localDescription!.type,
    };
  }

  async applyAnswer(answer: VoiceAnswer): Promise<void> {
    await this.pc!.setRemoteDescription(answer as RTCSessionDescriptionInit);
  }

  onConnectionFailed(cb: () => void): void {
    if (!this.pc) return;
    this.pc.onconnectionstatechange = () => {
      const s = this.pc?.connectionState;
      if (s === "failed" || s === "closed") cb();
    };
  }

  close(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.stream = null;
    this.pc = null;
  }
}
