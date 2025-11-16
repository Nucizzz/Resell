import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Quagga, { type QuaggaJSResultObject } from "@ericblade/quagga2";
import {
  ACCEPTED_LENGTHS,
  NormalizedGTIN,
  Symbology,
  isValidBarcode,
  normalizeGTIN,
  sanitizeCode,
  symbologyFromResult,
} from "../utils/barcode";

const DETECTION_WINDOW_MS = 3500;
const MIN_HITS = 6;
const MIN_CONFIDENCE = 0.6;
const HIGH_CONF_STREAK = 3;
const STREAK_THRESHOLD = 0.75;
const DECAY_MS = 1500;
const MAX_BUCKET_SIZE = 15;
const RUNNER_DELTA = 0.15;
const RUNNER_HIT_GAP = 3;
const ROI = { top: "25%", bottom: "25%", left: "15%", right: "15%" } as const;
const COOLDOWN_MS = 900;
const FRAME_FREQUENCY = 6;
const STATUS_DEFAULT = "Allinea il barcode nella fascia centrale";

export type DetectedPayload = {
  raw: string;
  symbology: Symbology;
  normalized: NormalizedGTIN;
  imageData?: string;
};

export type ScannerStatus = { light: number; stability: number; roiFill: number };

export type ScannerProps = {
  onDetected: (payload: DetectedPayload) => void | Promise<void>;
  onError?: (message: string) => void;
  onStatus?: (status: ScannerStatus) => void;
  enableCode128?: boolean;
  enableUPCE?: boolean;
};

type DetectionHit = { code: string; confidence: number; timestamp: number; symbology: Symbology; roiFill: number };

type ZXingReader = {
  decodeFromCanvas: (canvas: HTMLCanvasElement) => Promise<{ getText: () => string } | null>;
};

const BASE_READERS = ["ean_reader", "upc_reader"] as const;

function getROIBox(video: HTMLVideoElement) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  return {
    x: (parseFloat(ROI.left) / 100) * width,
    y: (parseFloat(ROI.top) / 100) * height,
    w: width * (1 - (parseFloat(ROI.left) + parseFloat(ROI.right)) / 100),
    h: height * (1 - (parseFloat(ROI.top) + parseFloat(ROI.bottom)) / 100),
  };
}

function cropToROI(video: HTMLVideoElement, scale = 1.5) {
  const roi = getROIBox(video);
  const canvas = document.createElement("canvas");
  canvas.width = roi.w * scale;
  canvas.height = roi.h * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(
    video,
    roi.x,
    roi.y,
    roi.w,
    roi.h,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

export default function Scanner({ onDetected, onError, onStatus, enableCode128, enableUPCE }: ScannerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const detectionHistory = useRef<DetectionHit[]>([]);
  const lastConfirmedRef = useRef<{ code: string; timestamp: number } | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const zxingRef = useRef<ZXingReader | null>(null);
  const motionBlockUntil = useRef<number>(0);

  const [running, setRunning] = useState(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [torch, setTorch] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [status, setStatus] = useState(STATUS_DEFAULT);
  const [error, setError] = useState<string | null>(null);
  const [roiFill, setRoiFill] = useState(0);
  const [lightLevel, setLightLevel] = useState(1);
  const [stability, setStability] = useState(1);

  const readers = useMemo(() => {
    const list = [...BASE_READERS];
    if (enableUPCE) list.push("upc_e_reader");
    if (enableCode128) list.splice(0, list.length, "code_128_reader");
    return list;
  }, [enableCode128, enableUPCE]);

  const emitStatus = useCallback(
    (next: Partial<ScannerStatus>) => {
      const merged: ScannerStatus = {
        light: next.light ?? lightLevel,
        stability: next.stability ?? stability,
        roiFill: next.roiFill ?? roiFill,
      };
      onStatus?.(merged);
    },
    [onStatus, lightLevel, stability, roiFill],
  );

  useEffect(() => {
    let active = true;
    async function enumerate() {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      } catch (err) {
        console.warn("Camera permission request", err);
      }
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        if (!active) return;
        const cams = all.filter((d) => d.kind === "videoinput");
        setDevices(cams);
        if (!deviceId && cams.length) setDeviceId(cams[0].deviceId);
      } catch (err) {
        console.error("Enumerate devices failed", err);
      }
    }
    enumerate();
    return () => {
      active = false;
    };
  }, [deviceId]);

  useEffect(() => {
    if (!running) {
      stopScanner();
      return;
    }
    if (!containerRef.current) return;

    let cancelled = false;
    setError(null);
    detectionHistory.current = [];

    const initConfig = {
      inputStream: {
        type: "LiveStream" as const,
        target: containerRef.current,
        constraints: {
          width: { ideal: 1280, min: 960 },
          height: { ideal: 720, min: 540 },
          frameRate: { ideal: 24, max: 30 },
          facingMode: { ideal: "environment" },
          deviceId: deviceId ? { exact: deviceId } : undefined,
        },
        area: ROI,
      },
      decoder: { readers },
      locator: { patchSize: "medium" as const, halfSample: true },
      locate: true,
      numOfWorkers: typeof navigator !== "undefined" && navigator.hardwareConcurrency
        ? Math.max(1, navigator.hardwareConcurrency - 1)
        : 2,
      frequency: FRAME_FREQUENCY,
    };

    const start = async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          Quagga.init(initConfig, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        if (cancelled) return;
        await Quagga.start();
        setStatus(STATUS_DEFAULT);
        const track: MediaStreamTrack | undefined = (Quagga as any)?.CameraAccess?.getActiveTrack?.();
        if (track) {
          videoTrackRef.current = track;
          await tuneTrack(track, torch, setTorchAvailable);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Quagga init failed", err);
        const message = "Impossibile avviare lo scanner";
        setError(message);
        onError?.(message);
        stopScanner();
        return;
      }

      const handler = (result: QuaggaJSResultObject) => {
        if (cancelled) return;
        const now = Date.now();
        if (now < motionBlockUntil.current) return;
        const rawCode = sanitizeCode(result?.codeResult?.code);
        const confidence = typeof result?.codeResult?.confidence === "number" ? result.codeResult.confidence : 0;
        if (!rawCode || confidence < MIN_CONFIDENCE) return;
        if (!ACCEPTED_LENGTHS.has(rawCode.length)) return;

        const symbology = symbologyFromResult(result?.codeResult?.format, rawCode);
        if (symbology === "CODE_128" && !enableCode128) return;
        if (!enableCode128 && symbology === "EAN_8" && !readers.includes("ean_8_reader")) return;
        if (!isValidBarcode(rawCode)) return;

        if (
          lastConfirmedRef.current &&
          lastConfirmedRef.current.code === rawCode &&
          now - lastConfirmedRef.current.timestamp < COOLDOWN_MS
        ) {
          return;
        }

        const box = result.box;
        if (box && box.length >= 2) {
          const width = Math.abs(box[1].x - box[0].x);
          const height = Math.abs(box[2]?.y - box[1]?.y || 0);
          const video = containerRef.current?.querySelector("video");
          if (video && video.videoWidth && video.videoHeight) {
            const roi = getROIBox(video);
            const fill = (width * height) / (roi.w * roi.h);
            setRoiFill(fill);
            emitStatus({ roiFill: fill });
          }
        }

        const video = containerRef.current?.querySelector("video");
        if (video) estimateLight(video).then((light) => {
          setLightLevel(light);
          emitStatus({ light });
        });

        pruneHits(now);
        detectionHistory.current.push({ code: rawCode, confidence, timestamp: now, symbology, roiFill: roiFill || 0 });
        if (detectionHistory.current.length > MAX_BUCKET_SIZE) detectionHistory.current.shift();

        const streak = highConfidenceStreak(rawCode);
        const { candidate, runnerUp } = summarize(now);
        if (candidate && shouldAccept(candidate, runnerUp, streak)) {
          finalize(candidate);
        } else {
          const hits = candidate?.hits ?? 0;
          const mean = candidate?.meanConfidence ?? 0;
          setStatus(`Sto verificando ${rawCode} (${hits}/${MIN_HITS}, conf ${mean.toFixed(2)})…`);
        }
      };

      Quagga.onDetected(handler);
      return () => Quagga.offDetected(handler);
    };

    let unsubscribe: (() => void) | undefined;
    start().then((detach) => {
      unsubscribe = detach;
    });

    const motion = (event: DeviceMotionEvent) => {
      const g = event.accelerationIncludingGravity;
      if (!g) return;
      const magnitude = Math.sqrt((g.x || 0) ** 2 + (g.y || 0) ** 2 + (g.z || 0) ** 2);
      const normalized = Math.min(1, magnitude / 20);
      const stable = 1 - normalized;
      setStability(stable);
      emitStatus({ stability: stable });
      if (normalized > 0.35) {
        motionBlockUntil.current = Date.now() + 500;
        setStatus("Ferma il dispositivo per migliorare la lettura…");
      }
    };
    window.addEventListener("devicemotion", motion, { passive: true });

    return () => {
      cancelled = true;
      unsubscribe?.();
      window.removeEventListener("devicemotion", motion);
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, readers, running, enableCode128]);

  useEffect(() => {
    const track = videoTrackRef.current;
    if (!track) return;
    tuneTrack(track, torch, setTorchAvailable).catch((err) => console.warn("Torch constraint error", err));
  }, [torch]);

  const pruneHits = (now: number) => {
    detectionHistory.current = detectionHistory.current.filter((hit) => now - hit.timestamp <= DETECTION_WINDOW_MS);
  };

  const summarize = (now: number) => {
    const buckets = new Map<string, { hits: number; weighted: number; weight: number; symbology: Symbology }>();
    for (const hit of detectionHistory.current) {
      const weight = Math.exp(-(now - hit.timestamp) / DECAY_MS);
      const current = buckets.get(hit.code) || { hits: 0, weighted: 0, weight: 0, symbology: hit.symbology };
      current.hits += 1;
      current.weighted += hit.confidence * weight;
      current.weight += weight;
      current.symbology = hit.symbology;
      buckets.set(hit.code, current);
    }
    const arr = Array.from(buckets.entries()).map(([code, data]) => ({
      code,
      symbology: data.symbology,
      hits: data.hits,
      meanConfidence: data.weight > 0 ? data.weighted / data.weight : 0,
    }));
    arr.sort((a, b) => (b.hits - a.hits) || (b.meanConfidence - a.meanConfidence));
    return { candidate: arr[0], runnerUp: arr[1] };
  };

  const highConfidenceStreak = (code: string) => {
    let streak = 0;
    for (let i = detectionHistory.current.length - 1; i >= 0; i -= 1) {
      const hit = detectionHistory.current[i];
      if (hit.code !== code) break;
      if (hit.confidence >= STREAK_THRESHOLD) streak += 1;
      else break;
    }
    return streak;
  };

  const shouldAccept = (
    candidate?: { code: string; hits: number; meanConfidence: number; symbology: Symbology },
    runnerUp?: { code: string; hits: number; meanConfidence: number },
    streak = 0,
  ) => {
    if (!candidate) return false;
    const dominanceHits = runnerUp ? candidate.hits - runnerUp.hits >= RUNNER_HIT_GAP : true;
    const dominanceConf = runnerUp ? candidate.meanConfidence - runnerUp.meanConfidence >= RUNNER_DELTA : true;
    const threshold = candidate.hits >= MIN_HITS && candidate.meanConfidence >= MIN_CONFIDENCE;
    const strongStreak = streak >= HIGH_CONF_STREAK;
    return (threshold && (dominanceHits || dominanceConf)) || strongStreak;
  };

  const finalize = async (candidate: { code: string; symbology: Symbology }) => {
    detectionHistory.current = [];
    setStatus("Verifica finale…");
    try {
      const verified = await verifyCandidate(candidate.code);
      const finalCode = verified || candidate.code;
      const sym = symbologyFromResult(undefined, finalCode);
      const normalized = normalizeGTIN(sym, finalCode);
      lastConfirmedRef.current = { code: finalCode, timestamp: Date.now() };
      navigator.vibrate?.(30);
      await onDetected({ raw: finalCode, symbology: sym, normalized, imageData: undefined });
      setStatus(STATUS_DEFAULT);
    } catch (err) {
      console.error("Finalize detection error", err);
      const message = "Errore durante la verifica del barcode";
      setError(message);
      onError?.(message);
    }
  };

  const verifyCandidate = async (code: string): Promise<string | null> => {
    const video = containerRef.current?.querySelector("video");
    if (!video) return null;
    const roiCanvas = cropToROI(video, 1.5);
    if (!roiCanvas) return null;

    const zxing = await loadZXing();
    if (zxing) {
      try {
        const result = await zxing.decodeFromCanvas(roiCanvas);
        const zxCode = sanitizeCode(result?.getText());
        if (zxCode && isValidBarcode(zxCode)) return zxCode;
      } catch (err) {
        console.warn("ZXing verify failed", err);
      }
    }

    return new Promise<string | null>((resolve) => {
      Quagga.decodeSingle(
        {
          src: roiCanvas.toDataURL("image/png"),
          numOfWorkers: 0,
          decoder: { readers },
          locator: { patchSize: "large" as const, halfSample: false },
          locate: true,
          inputStream: { size: 1920 },
        },
        (result) => {
          const codeResult = sanitizeCode(result?.codeResult?.code);
          resolve(codeResult && isValidBarcode(codeResult) ? codeResult : null);
        },
      );
    });
  };

  const loadZXing = async (): Promise<ZXingReader | null> => {
    if (zxingRef.current) return zxingRef.current;
    try {
      const { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } = await import(
        /* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm"
      );
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.UPC_A]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints);
      zxingRef.current = reader as unknown as ZXingReader;
      return zxingRef.current;
    } catch (err) {
      console.warn("ZXing not available", err);
      return null;
    }
  };

  const stopScanner = () => {
    try {
      Quagga.stop();
    } catch (err) {
      console.warn("Quagga stop", err);
    }
    const video = containerRef.current?.querySelector("video");
    const stream = video?.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    }
    videoTrackRef.current = null;
    setTorchAvailable(false);
  };

  const estimateLight = async (video: HTMLVideoElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 1;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
    }
    const avg = sum / (data.length / 4) / 255;
    return avg;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <button className="btn" onClick={() => setRunning((prev) => !prev)}>{running ? "Metti in pausa" : "Riattiva"}</button>
        {torchAvailable && (
          <button className="btn" onClick={() => setTorch((p) => !p)}>{torch ? "Torcia ON" : "Torcia OFF"}</button>
        )}
        {devices.length > 1 && (
          <select className="input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || "Fotocamera"}
              </option>
            ))}
          </select>
        )}
      </div>

      <div ref={containerRef} className="relative w-full overflow-hidden rounded-2xl bg-black aspect-[3/2]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-[25%] bg-black/60" />
          <div className="absolute bottom-0 left-0 right-0 h-[25%] bg-black/60" />
          <div className="absolute top-[25%] bottom-[25%] left-0 w-[15%] bg-black/60" />
          <div className="absolute top-[25%] bottom-[25%] right-0 w-[15%] bg-black/60" />
          <div
            className={`absolute top-[25%] bottom-[25%] left-[15%] right-[15%] border-2 rounded-xl transition-colors duration-200 ${
              roiFill >= 0.4 && roiFill <= 0.6 ? "border-green-400" : "border-white/80"
            }`}
          />
        </div>
        {!running && <div className="absolute inset-0 flex items-center justify-center text-white bg-black/70">Scanner in pausa</div>}
      </div>

      <div className="flex gap-3 text-xs text-gray-600">
        <div className="flex-1">
          <div className="flex justify-between"><span>Luce</span><span>{Math.round(lightLevel * 100)}%</span></div>
          <div className="h-2 rounded bg-gray-100 overflow-hidden"><div className="h-full bg-amber-500" style={{ width: `${Math.min(100, Math.round(lightLevel * 100))}%` }} /></div>
        </div>
        <div className="flex-1">
          <div className="flex justify-between"><span>Stabilità</span><span>{Math.round(stability * 100)}%</span></div>
          <div className="h-2 rounded bg-gray-100 overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${Math.min(100, Math.round(stability * 100))}%` }} /></div>
        </div>
      </div>

      <p className="text-sm text-gray-700 min-h-[1.5rem]">{status}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

async function tuneTrack(track: MediaStreamTrack, torchOn: boolean, setTorchAvailable: (v: boolean) => void) {
  const capabilities = track.getCapabilities?.();
  if (!capabilities) {
    setTorchAvailable(false);
    return;
  }
  const advanced: MediaTrackConstraints & { torch?: boolean; focusMode?: string; exposureMode?: string } = {};
  if (Array.isArray((capabilities as any).focusMode) && (capabilities as any).focusMode.includes("continuous")) {
    (advanced as any).focusMode = "continuous";
  }
  if (Array.isArray((capabilities as any).exposureMode) && (capabilities as any).exposureMode.includes("continuous")) {
    (advanced as any).exposureMode = "continuous";
  }
  if (capabilities.zoom) {
    advanced.zoom = Math.min(capabilities.zoom.max ?? 2, Math.max(capabilities.zoom.min ?? 1, 2));
  }
  if ("torch" in capabilities && typeof (capabilities as any).torch === "boolean") {
    setTorchAvailable(true);
    (advanced as any).torch = torchOn;
  } else {
    setTorchAvailable(false);
  }
  if (Object.keys(advanced).length === 0) return;
  try {
    await track.applyConstraints({ advanced: [advanced] });
  } catch (err) {
    console.warn("Advanced constraints failed", err);
  }
}
