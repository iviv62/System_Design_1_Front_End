export type MediaTroubleshootSuccess = {
  success: true;
  stream: MediaStream;
  devices: MediaDeviceInfo[];
};

export type MediaTroubleshootFailure = {
  success: false;
  error: string;
  devices?: MediaDeviceInfo[];
  errorName?: string;
};

export type MediaTroubleshootResult = MediaTroubleshootSuccess | MediaTroubleshootFailure;

type TroubleshootOptions = {
  requestAudio?: boolean;
  requestVideo?: boolean;
};

export async function troubleshootMediaDevices(
  options: TroubleshootOptions = {},
): Promise<MediaTroubleshootResult> {
  const { requestAudio = true, requestVideo = true } = options;

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("[MediaDiagnostics] getUserMedia not supported");
      return {
        success: false,
        error: "Browser does not support media devices.",
      };
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    console.log("[MediaDiagnostics] available devices:", devices);

    const videoDevices = devices.filter((d) => d.kind === "videoinput");
    const audioDevices = devices.filter((d) => d.kind === "audioinput");

    if (requestVideo && videoDevices.length === 0) {
      console.warn("[MediaDiagnostics] no video devices found");
    }
    if (requestAudio && audioDevices.length === 0) {
      console.warn("[MediaDiagnostics] no audio devices found");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: requestVideo,
      audio: requestAudio,
    });

    console.log("[MediaDiagnostics] media devices working correctly");

    return {
      success: true,
      stream,
      devices,
    };
  } catch (error) {
    const e = error as DOMException;
    console.error("[MediaDiagnostics] media device error:", e.name, e.message);

    switch (e.name) {
      case "NotAllowedError":
        return {
          success: false,
          error: "Permission denied. Please allow microphone/camera access for this site.",
          errorName: e.name,
        };
      case "NotFoundError":
        return {
          success: false,
          error: "No microphone or camera found.",
          errorName: e.name,
        };
      case "NotReadableError":
        return {
          success: false,
          error: "Media device is busy in another application.",
          errorName: e.name,
        };
      default:
        return {
          success: false,
          error: `Media error: ${e.message || "Unknown media failure."}`,
          errorName: e.name,
        };
    }
  }
}
