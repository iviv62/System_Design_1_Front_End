export type ConnectionMetrics = {
  latencyMs: number;
  packetLossPct: number;
  bandwidthMbps: number;
  fps: number;
};

type StatsSnapshot = {
  timestampMs: number;
  bytesReceived: number;
  framesDecoded: number;
  packetsReceived: number;
  packetsLost: number;
  currentRoundTripTimeSec: number;
  availableOutgoingBitrateBps: number;
};

export class ConnectionMonitor {
  private readonly peerConnection: RTCPeerConnection;
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private previous: StatsSnapshot | null = null;

  constructor(peerConnection: RTCPeerConnection) {
    this.peerConnection = peerConnection;
  }

  startMonitoring(callback?: (metrics: ConnectionMetrics) => void): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(async () => {
      try {
        const snapshot = await this.collectStats();
        const metrics = this.calculateMetrics(snapshot, this.previous);
        this.previous = snapshot;
        callback?.(metrics);
      } catch (error) {
        console.debug("[ConnectionMonitor] failed to collect stats", error);
      }
    }, 1000);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.previous = null;
  }

  private async collectStats(): Promise<StatsSnapshot> {
    const stats = await this.peerConnection.getStats();
    let bytesReceived = 0;
    let framesDecoded = 0;
    let packetsReceived = 0;
    let packetsLost = 0;
    let currentRoundTripTimeSec = 0;
    let availableOutgoingBitrateBps = 0;
    let reportTimestampMs = Date.now();

    stats.forEach((report) => {
      reportTimestampMs = report.timestamp;

      if (report.type === "inbound-rtp") {
        const r = report as RTCInboundRtpStreamStats & {
          kind?: string;
          mediaType?: string;
          isRemote?: boolean;
          bytesReceived?: number;
          packetsReceived?: number;
          packetsLost?: number;
          framesDecoded?: number;
        };
        if (r.isRemote) return;

        const kind = r.kind ?? r.mediaType;
        if (kind !== "audio" && kind !== "video") return;

        bytesReceived += r.bytesReceived ?? 0;
        packetsReceived += r.packetsReceived ?? 0;
        packetsLost += r.packetsLost ?? 0;
        if (kind === "video") {
          framesDecoded += r.framesDecoded ?? 0;
        }
      }

      if (report.type === "candidate-pair") {
        const r = report as RTCIceCandidatePairStats;
        if (r.state !== "succeeded") return;

        // Prefer nominated pair when available.
        if ((r.nominated ?? false) || currentRoundTripTimeSec === 0) {
          currentRoundTripTimeSec = r.currentRoundTripTime ?? currentRoundTripTimeSec;
          availableOutgoingBitrateBps = r.availableOutgoingBitrate ?? availableOutgoingBitrateBps;
        }
      }
    });

    return {
      timestampMs: reportTimestampMs,
      bytesReceived,
      framesDecoded,
      packetsReceived,
      packetsLost,
      currentRoundTripTimeSec,
      availableOutgoingBitrateBps,
    };
  }

  private calculateMetrics(
    current: StatsSnapshot,
    previous: StatsSnapshot | null,
  ): ConnectionMetrics {
    let bandwidthMbps = 0;
    let fps = 0;

    if (previous) {
      const dtSec = Math.max((current.timestampMs - previous.timestampMs) / 1000, 0.001);
      const deltaBytes = Math.max(current.bytesReceived - previous.bytesReceived, 0);
      const deltaFrames = Math.max(current.framesDecoded - previous.framesDecoded, 0);
      bandwidthMbps = (deltaBytes * 8) / (dtSec * 1_000_000);
      fps = deltaFrames / dtSec;
    }

    if (bandwidthMbps === 0 && current.availableOutgoingBitrateBps > 0) {
      bandwidthMbps = current.availableOutgoingBitrateBps / 1_000_000;
    }

    const totalPackets = current.packetsReceived + current.packetsLost;
    const packetLossPct = totalPackets > 0 ? (current.packetsLost / totalPackets) * 100 : 0;

    return {
      latencyMs: Number((current.currentRoundTripTimeSec * 1000).toFixed(2)),
      packetLossPct: Number(packetLossPct.toFixed(2)),
      bandwidthMbps: Number(bandwidthMbps.toFixed(2)),
      fps: Number(fps.toFixed(1)),
    };
  }
}
