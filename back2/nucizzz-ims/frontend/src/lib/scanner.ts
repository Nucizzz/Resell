import { BrowserMultiFormatReader, BarcodeFormat } from "@zxing/browser";

type CodeCallback = (code: string) => void;

type BarcodeDetection = { rawValue?: string };
type BarcodeDetectorApi = {
  detect(source: CanvasImageSource | HTMLVideoElement): Promise<BarcodeDetection[]>;
};
type BarcodeDetectorConstructor = new (options?: { formats?: readonly string[] }) => BarcodeDetectorApi;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

const ZXING_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.QR_CODE,
];

const BARCODE_DETECTOR_FORMATS = [
  "ean_13",
  "ean_8",
  "code_128",
  "code_39",
  "upc_a",
  "upc_e",
  "itf",
  "qr_code",
] as const;

const DEDUPE_WINDOW = 1600;
const DEVICE_CACHE_KEY = "ims.scanner.deviceId";

export type StartOpts = {
  deviceId?: string;
  facingMode?: "environment" | "user";
  roi?: DOMRect;
  videoRect?: DOMRect;
};

export type Scanner = {
  start(video: HTMLVideoElement, opts?: StartOpts): Promise<void>;
  stop(): void;
  switchDevice(deviceId: string): Promise<void>;
  listVideoInputs(): Promise<MediaDeviceInfo[]>;
  onCode(cb: CodeCallback): void;
  isActive(): boolean;
  getActiveTrack(): MediaStreamTrack | null;
  setTorch(enabled: boolean): Promise<boolean>;
  supportsTorch(): boolean;
};

type RoiPercentages = { x: number; y: number; width: number; height: number } | null;

function computeRoiPercentages(roi?: DOMRect, videoRect?: DOMRect): RoiPercentages {
  if (!roi || !videoRect) return null;
  const width = Math.max(videoRect.width, 1);
  const height = Math.max(videoRect.height, 1);
  return {
    x: Math.max(0, (roi.left - videoRect.left) / width),
    y: Math.max(0, (roi.top - videoRect.top) / height),
    width: Math.min(1, roi.width / width),
    height: Math.min(1, roi.height / height),
  };
}

async function loadZXingReader() {
  return new BrowserMultiFormatReader(undefined, ZXING_FORMATS);
}

async function enumerateVideoInputs(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    let devices = await navigator.mediaDevices.enumerateDevices();
    if (!devices.some((d) => d.kind === "videoinput")) {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      tempStream.getTracks().forEach((track) => track.stop());
      devices = await navigator.mediaDevices.enumerateDevices();
    }
    return devices.filter((d) => d.kind === "videoinput");
  } catch (err) {
    console.warn("Unable to enumerate cameras", err);
    throw err;
  }
}

export function createScanner(): Scanner {
  let mediaStream: MediaStream | null = null;
  let videoEl: HTMLVideoElement | null = null;
  let rafId: number | null = null;
  let timerId: number | null = null;
  let barcodeDetector: BarcodeDetectorApi | null = null;
  let zxReader: BrowserMultiFormatReader | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let roiPercents: RoiPercentages = null;
  let active = false;
  let callback: CodeCallback = () => {};
  let lastCode = "";
  let lastTime = 0;
  let torchEnabled = false;
  let lastOpts: StartOpts | undefined;

  const ensureCanvas = () => {
    if (canvas && ctx) return;
    canvas = document.createElement("canvas");
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  };

  const cleanupLoops = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (timerId) {
      window.clearTimeout(timerId);
      timerId = null;
    }
  };

  const teardownStream = () => {
    cleanupLoops();
    zxReader?.reset?.();
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }
    if (videoEl) {
      videoEl.srcObject = null;
    }
    mediaStream = null;
    torchEnabled = false;
    active = false;
  };

  const emit = (code: string) => {
    if (!code) return;
    const normalized = typeof code === "string" ? code : String(code);
    const now = Date.now();
    if (normalized === lastCode && now - lastTime < DEDUPE_WINDOW) return;
    lastCode = normalized;
    lastTime = now;
    callback(normalized);
  };

  const detectWithBarcodeDetector = async () => {
    if (!barcodeDetector || !videoEl || !active) return;
    try {
      const detections = await barcodeDetector.detect(videoEl);
      if (detections.length) {
        const best = detections[0];
        if (best.rawValue) {
          emit(best.rawValue);
        }
      }
    } catch (err) {
      console.warn("BarcodeDetector detect error", err);
    }
    if (active) {
      rafId = requestAnimationFrame(detectWithBarcodeDetector);
    }
  };

  const detectWithZXing = async () => {
    if (!zxReader || !ctx || !videoEl || !active) return;
    const videoWidth = videoEl.videoWidth;
    const videoHeight = videoEl.videoHeight;
    if (!videoWidth || !videoHeight) {
      timerId = window.setTimeout(detectWithZXing, 250);
      return;
    }

    const roi = roiPercents
      ? {
          sx: roiPercents.x * videoWidth,
          sy: roiPercents.y * videoHeight,
          sw: roiPercents.width * videoWidth,
          sh: roiPercents.height * videoHeight,
        }
      : {
          sx: videoWidth * 0.1,
          sy: videoHeight * 0.2,
          sw: videoWidth * 0.8,
          sh: videoHeight * 0.6,
        };

    canvas!.width = roi.sw;
    canvas!.height = roi.sh;
    ctx!.drawImage(videoEl, roi.sx, roi.sy, roi.sw, roi.sh, 0, 0, roi.sw, roi.sh);
    try {
      const result = await zxReader.decodeFromCanvas(canvas!);
      if (result?.getText()) {
        emit(result.getText());
      }
    } catch {
      // ignore decode errors
    }

    if (active) {
      timerId = window.setTimeout(detectWithZXing, 250);
    }
  };

  const buildConstraints = (opts?: StartOpts): MediaStreamConstraints => {
    const supported = navigator.mediaDevices.getSupportedConstraints?.() ?? {};
    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      aspectRatio: { ideal: 1.777 },
    };

    if (opts?.deviceId) {
      videoConstraints.deviceId = { exact: opts.deviceId };
    } else if (opts?.facingMode) {
      videoConstraints.facingMode = { ideal: opts.facingMode };
    } else {
      videoConstraints.facingMode = { ideal: "environment" };
    }

    if (supported.focusMode) {
      (videoConstraints as any).focusMode = "continuous";
    }

    return {
      audio: false,
      video: videoConstraints,
    };
  };

  const startStream = async (video: HTMLVideoElement, opts?: StartOpts) => {
    teardownStream();
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera non disponibile sul dispositivo");
    }
    videoEl = video;
    videoEl.autoplay = true;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute("playsinline", "true");
    videoEl.crossOrigin = "anonymous";

    const constraints = buildConstraints(opts);
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = mediaStream.getVideoTracks()[0];
    videoEl.srcObject = mediaStream;
    try {
      await videoEl.play();
    } catch (err) {
      console.warn("Video play error", err);
    }

    roiPercents = computeRoiPercentages(opts?.roi, opts?.videoRect);
    barcodeDetector = null;
    try {
      if (window.BarcodeDetector) {
        barcodeDetector = new window.BarcodeDetector({ formats: BARCODE_DETECTOR_FORMATS });
      }
    } catch (err) {
      console.warn("BarcodeDetector unavailable", err);
      barcodeDetector = null;
    }

    ensureCanvas();
    if (!zxReader) {
      zxReader = await loadZXingReader();
    }

    active = true;
    if (barcodeDetector) {
      detectWithBarcodeDetector();
    } else {
      detectWithZXing();
    }

    torchEnabled = false;
  };

  const start: Scanner["start"] = async (video, opts) => {
    lastOpts = { ...opts };
    await startStream(video, opts);
  };

  const switchDevice: Scanner["switchDevice"] = async (deviceId) => {
    if (!videoEl) throw new Error("Video element non inizializzato");
    lastOpts = { ...(lastOpts || {}), deviceId };
    await startStream(videoEl, lastOpts);
  };

  const stop = () => {
    teardownStream();
    videoEl = null;
    lastOpts = undefined;
  };

  const onCode = (cb: CodeCallback) => {
    callback = cb;
  };

  const getActiveTrack = () => mediaStream?.getVideoTracks()[0] ?? null;

  const supportsTorch = () => {
    const track = getActiveTrack();
    const caps = track?.getCapabilities?.();
    return Boolean(caps && "torch" in caps);
  };

  const setTorch = async (enabled: boolean) => {
    const track = getActiveTrack();
    if (!track || !supportsTorch()) {
      return false;
    }
    try {
      await track.applyConstraints({ advanced: [{ torch: enabled }] });
      torchEnabled = enabled;
      return true;
    } catch (err) {
      console.warn("Torch toggle error", err);
      return false;
    }
  };

  const listVideoInputs = async () => {
    const list = await enumerateVideoInputs();
    if (list.length && typeof window !== "undefined") {
      const saved = localStorage.getItem(DEVICE_CACHE_KEY);
      if (saved && list.some((d) => d.deviceId === saved)) {
        lastOpts = { ...(lastOpts || {}), deviceId: saved };
      }
    }
    return list;
  };

  return {
    start,
    stop,
    switchDevice,
    listVideoInputs,
    onCode,
    isActive: () => active,
    getActiveTrack,
    setTorch: (enabled) => setTorch(enabled),
    supportsTorch,
  };
}

