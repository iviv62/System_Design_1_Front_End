import { VoiceCallAdapter, type VoiceAnswer } from "./voice-call-adapter";
import { getApiBaseUrl } from "./chat-config";

export type VoiceCallState = "idle" | "calling" | "active" | "error";

export type VoiceCallControllerOptions = {
  apiBase: string | undefined;
  wsBase: string | undefined;
  room: string;
  username: string;
  onStateChange: (state: VoiceCallState) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onParticipantsChange?: (participants: { peer_id: string; username: string }[]) => void;
};

export class VoiceCallController {
  private adapter = new VoiceCallAdapter();
  private peerId: string | null = null;
  private readonly options: VoiceCallControllerOptions;

  constructor(options: VoiceCallControllerOptions) {
    this.options = options;
  }

  async handleRemoteIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.adapter.addIceCandidate(candidate);
  }

  updateIdentity(room: string, username: string): void {
    (this.options as Record<string, unknown>)["room"] = room;
    (this.options as Record<string, unknown>)["username"] = username;
  }

  async start(): Promise<void> {
    if (this.peerId) return;
    this.options.onStateChange("calling");

    try {
      await this.adapter.openConnection({ onIceCandidate: this.options.onIceCandidate });
      const offer = await this.adapter.createOffer();

      const base = getApiBaseUrl(this.options.apiBase, this.options.wsBase);
      const res = await fetch(`${base}/voice/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...offer,
          room: this.options.room,
          username: this.options.username,
        }),
      });

      if (!res.ok) throw new Error(`Offer rejected: ${res.status}`);

      const answer: VoiceAnswer = await res.json();
      this.peerId = answer.peer_id;

      await this.adapter.applyAnswer(answer);
      this.adapter.onConnectionFailed(() => void this.stop());

      this.options.onStateChange("active");
    } catch (err) {
      console.error("[VoiceCallController] start failed", err);
      this.adapter.close();
      this.options.onStateChange("error");
    }
  }

  async stop(): Promise<void> {
    const peerId = this.peerId;
    this.peerId = null;
    this.adapter.close();
    this.options.onStateChange("idle");

    if (peerId) {
      const base = getApiBaseUrl(this.options.apiBase, this.options.wsBase);
      await fetch(`${base}/voice/stop/${peerId}`, { method: "POST" }).catch(() => {});
    }
  }
}
