import React, { useEffect, useMemo, useRef, useState } from "react";
import Quagga, { type QuaggaJSResultObject } from "@ericblade/quagga2";

export type ScannerProps = {
  onDetected: (code: string) => void | Promise<void>;
  onError?: (message: string) => void;
  enableCode128?: boolean;
};

const BASE_READERS = ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader"] as const;

export const DETECTION_WINDOW_MS = 3500;
export const MIN_CONFIRMATIONS = 6;
export const CONFIDENCE_THRESHOLD = 0.6;
const HIGH_CONFIDENCE_THRESHOLD = 0.75;
const DECAY_MS = 1500;
const FRAME_FREQUENCY = 6;
const DEFAULT_STATUS = "Allinea il barcode nella fascia centrale";
const ACCEPTED_LENGTHS = new Set([8, 12, 13]);
const REPEAT_COOLDOWN_MS = 1200;

type DetectionHit = { code: string; timestamp: number; confidence: number };
type DetectionSummary = { code: string; hits: number; meanConfidence: number; runnerDelta?: number };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const sanitizeCode = (raw: string | undefined | null) => {
  if (!raw) return "";
  return raw.replace(/[^0-9]/g, "");
};

const checksumEAN13 = (code: string) => {
  const digits = code.split("").map((d) => Number(d));
  const checkDigit = digits.pop() ?? 0;
  const sum = digits.reduce((acc, digit, idx) => acc + digit * (idx % 2 === 0 ? 1 : 3), 0);
  const calc = (10 - (sum % 10)) % 10;
  return calc === checkDigit;
};

const checksumEAN8 = (code: string) => {
  const digits = code.split("").map((d) => Number(d));
  const checkDigit = digits.pop() ?? 0;
  const sum = digits.reduce((acc, digit, idx) => acc + digit * (idx % 2 === 0 ? 3 : 1), 0);
  const calc = (10 - (sum % 10)) % 10;
  return calc === checkDigit;
};

const checksumUPCA = (code: string) => {
  const digits = code.split("").map((d) => Number(d));
  const checkDigit = digits.pop() ?? 0;
  const oddSum = digits.reduce((acc, digit, idx) => acc + (idx % 2 === 0 ? digit : 0), 0);
  const evenSum = digits.reduce((acc, digit, idx) => acc + (idx % 2 === 1 ? digit : 0), 0);
  const total = oddSum * 3 + evenSum;
  const calc = (10 - (total % 10)) % 10;
  return calc === checkDigit;
};

const isValidBarcode = (code: string) => {
  if (!code || !ACCEPTED_LENGTHS.has(code.length)) return false;
  if (!/^\d+$/.test(code)) return false;
  if (code.length === 13) return checksumEAN13(code);
  if (code.length === 12) return checksumUPCA(code);
  return checksumEAN8(code);
};

const getPreferredCamera = (devices: MediaDeviceInfo[]) => {
  const rear = devices.find((d) => /rear|back|environment/i.test(d.label));
  if (rear) return rear.deviceId;
  const external = devices.find((d) => /usb|external/i.test(d.label));
  if (external) return external.deviceId;
  return devices[0]?.deviceId || "";
};

export default function Scanner({ onDetected, onError, enableCode128 }: ScannerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const detectionHistory = useRef<DetectionHit[]>([]);
  const finalizingRef = useRef(false);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const lastConfirmedRef = useRef<{ code: string; timestamp: number } | null>(null);
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const readers = useMemo(() => {
    const base = [...BASE_READERS];
    if (enableCode128) base.push("code_128_reader");
    return base;
  }, [enableCode128]);

  useEffect(() => {
    let active = true;
    async function enumerate() {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      } catch (err) {
        console.warn("Camera permission pending", err);
      }
      try {
        const available = await navigator.mediaDevices.enumerateDevices();
        if (!active) return;
        const cams = available.filter((d) => d.kind === "videoinput");
        setDevices(cams);
        if (!deviceId && cams.length) {
          setDeviceId(getPreferredCamera(cams));
        }
      } catch (err) {
        console.error("Unable to enumerate cameras", err);
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
    setStatus("Inizializzazione camera…");
    setError(null);
    detectionHistory.current = [];
    finalizingRef.current = false;

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
        area: { top: "25%", right: "15%", left: "15%", bottom: "25%" },
      },
      decoder: { readers },
      locator: { patchSize: "medium" as const, halfSample: true },
      locate: true,
      numOfWorkers:
        typeof navigator !== "undefined" && navigator.hardwareConcurrency
          ? Math.min(4, navigator.hardwareConcurrency)
          : 2,
      frequency: FRAME_FREQUENCY,
    };

    const start = async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          Quagga.init(initConfig, (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
        if (cancelled) return;
        await Quagga.start();
        setStatus(DEFAULT_STATUS);
        const activeTrack: MediaStreamTrack | undefined = (Quagga as any)?.CameraAccess?.getActiveTrack?.();
        if (activeTrack) {
          videoTrackRef.current = activeTrack;
          await tuneTrack(activeTrack, torchOn, setTorchAvailable);
        } else {
          videoTrackRef.current = null;
          setTorchAvailable(false);
        }
      } catch (err) {
        console.error("Quagga init failed", err);
        if (cancelled) return;
        const message = "Impossibile avviare lo scanner";
        setError(message);
        onError?.(message);
        stopScanner();
        return;
      }

      const handler = (result: QuaggaJSResultObject) => {
        if (cancelled || finalizingRef.current) return;
        const rawCode = result?.codeResult?.code;
        const confidence = typeof result?.codeResult?.confidence === "number" ? result.codeResult.confidence : 0;
        const digits = sanitizeCode(rawCode);
        if (!digits || confidence < CONFIDENCE_THRESHOLD) return;
        if (!isValidBarcode(digits)) return;

        const now = Date.now();
        if (lastConfirmedRef.current && lastConfirmedRef.current.code === digits && now - lastConfirmedRef.current.timestamp < REPEAT_COOLDOWN_MS) {
          return;
        }

        pruneHits(now);
        detectionHistory.current.push({ code: digits, timestamp: now, confidence });
        const summary = summarizeHits(now);
        const bucket = summary.find((item) => item.code === digits);
        const runnerUp = summary.find((item) => item.code !== digits);
        const streak = getHighConfidenceStreak(digits);

        if (bucket && shouldAccept(bucket, runnerUp, streak)) {
          finalizeDetection(bucket.code);
        } else {
          const hits = bucket?.hits ?? 0;
          const mean = bucket?.meanConfidence ?? 0;
          setStatus(`Sto verificando ${digits} (${hits}/${MIN_CONFIRMATIONS}, conf ${mean.toFixed(2)})…`);
        }
      };

      Quagga.onDetected(handler);

      return () => {
        Quagga.offDetected(handler);
      };
    };

    let detachListener: (() => void) | undefined;
    start().then((unsubscribe) => {
      detachListener = unsubscribe;
    });

    return () => {
      cancelled = true;
      detachListener?.();
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, readers, running]);

  useEffect(() => {
    const track = videoTrackRef.current;
    if (!track) return;
    tuneTrack(track, torchOn, setTorchAvailable).catch((err) => console.warn("Torch constraint error", err));
  }, [torchOn]);

  const pruneHits = (now: number) => {
    detectionHistory.current = detectionHistory.current.filter((hit) => now - hit.timestamp <= DETECTION_WINDOW_MS);
  };

  const summarizeHits = (now: number): DetectionSummary[] => {
    const buckets = new Map<string, { hits: number; weightedSum: number; weight: number }>();
    for (const hit of detectionHistory.current) {
      const weight = Math.exp(-(now - hit.timestamp) / DECAY_MS);
      const current = buckets.get(hit.code) || { hits: 0, weightedSum: 0, weight: 0 };
      current.hits += 1;
      current.weightedSum += hit.confidence * weight;
      current.weight += weight;
      buckets.set(hit.code, current);
    }
    const summary = Array.from(buckets.entries()).map(([code, value]) => ({
      code,
      hits: value.hits,
      meanConfidence: value.weight > 0 ? value.weightedSum / value.weight : 0,
    }));
    summary.sort((a, b) => {
      if (b.hits !== a.hits) return b.hits - a.hits;
      return b.meanConfidence - a.meanConfidence;
    });
    if (summary.length > 1) {
      const runner = summary[1];
      summary[0].runnerDelta = summary[0].meanConfidence - runner.meanConfidence;
    }
    return summary;
  };

  const getHighConfidenceStreak = (code: string) => {
    let streak = 0;
    for (let i = detectionHistory.current.length - 1; i >= 0; i -= 1) {
      const hit = detectionHistory.current[i];
      if (hit.code !== code) break;
      if (hit.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  };

  const shouldAccept = (candidate?: DetectionSummary, runnerUp?: DetectionSummary, streak = 0) => {
    if (!candidate) return false;
    const dominantByHits = runnerUp ? candidate.hits - runnerUp.hits >= 3 : true;
    const dominantByConf = runnerUp ? (candidate.meanConfidence - runnerUp.meanConfidence) >= 0.15 : true;
    const meetsThresholds = candidate.hits >= MIN_CONFIRMATIONS && candidate.meanConfidence >= CONFIDENCE_THRESHOLD;
    const strongStreak = streak >= 3;
    return (meetsThresholds && (dominantByHits || dominantByConf)) || strongStreak;
  };

  const captureFrame = () => {
    const video = containerRef.current?.querySelector("video");
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  const finalizeDetection = async (candidate: string) => {
    finalizingRef.current = true;
    detectionHistory.current = [];
    setStatus("Verifica finale…");
    try {
      const verified = await recheckCandidate(candidate);
      const finalCode = verified || candidate;
      if (finalCode) {
        navigator.vibrate?.(30);
        await onDetected(finalCode);
        lastConfirmedRef.current = { code: finalCode, timestamp: Date.now() };
      }
    } catch (err) {
      console.warn("Finalize detection error", err);
      const message = "Errore durante la verifica del barcode";
      setError(message);
      onError?.(message);
    } finally {
      setStatus(DEFAULT_STATUS);
      finalizingRef.current = false;
    }
  };

  const recheckCandidate = async (candidate: string) => {
    const frame = captureFrame();
    if (!frame) return null;
    return new Promise<string | null>((resolve) => {
      Quagga.decodeSingle(
        {
          src: frame.toDataURL("image/png"),
          numOfWorkers: 0,
          decoder: { readers },
          locator: { patchSize: "large" as const, halfSample: false },
          locate: true,
          inputStream: { size: 1920 },
        },
        (result) => {
          const code = sanitizeCode(result?.codeResult?.code);
          if (code && isValidBarcode(code)) {
            resolve(code);
          } else if (candidate && isValidBarcode(candidate)) {
            resolve(candidate);
          } else {
            resolve(null);
          }
        }
      );
    });
  };

  const stopScanner = () => {
    try {
      Quagga.stop();
    } catch (err) {
      console.warn("Quagga stop warning", err);
    }
    const video = containerRef.current?.querySelector("video");
    const stream = video?.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      if (video) {
        video.srcObject = null;
      }
    }
    videoTrackRef.current = null;
    setTorchAvailable(false);
    detectionHistory.current = [];
    lastConfirmedRef.current = null;
  };

  const onDeviceChange = (value: string) => {
    setDeviceId(value);
    detectionHistory.current = [];
  };

  const toggleTorch = () => {
    setTorchOn((prev) => !prev);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => setRunning((prev) => !prev)}>
          {running ? "Metti in pausa" : "Riattiva scanner"}
        </button>
        {torchAvailable && (
          <button className="btn" onClick={toggleTorch}>
            {torchOn ? "Torcia ON" : "Torcia OFF"}
          </button>
        )}
      </div>

      {devices.length > 1 && (
        <label className="flex flex-col text-xs text-gray-600 gap-1">
          Fotocamera
          <select className="input" value={deviceId} onChange={(e) => onDeviceChange(e.target.value)}>
            {devices.map((cam) => (
              <option key={cam.deviceId} value={cam.deviceId}>
                {cam.label || "Fotocamera"}
              </option>
            ))}
          </select>
        </label>
      )}

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-2xl bg-black aspect-[3/2]"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-[25%] bg-black/60" />
          <div className="absolute bottom-0 left-0 right-0 h-[25%] bg-black/60" />
          <div className="absolute top-[25%] bottom-[25%] left-0 w-[15%] bg-black/60" />
          <div className="absolute top-[25%] bottom-[25%] right-0 w-[15%] bg-black/60" />
          <div className="absolute top-[25%] bottom-[25%] left-[15%] right-[15%] border-2 border-white/80 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.7)]" />
        </div>
        {!running && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-sm">
            Scanner in pausa
          </div>
        )}
      </div>

      <p className="text-sm text-gray-700 min-h-[1.5rem]">{status}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

async function tuneTrack(
  track: MediaStreamTrack,
  torchOn: boolean,
  setTorchAvailable: (value: boolean) => void,
) {
  const capabilities = track.getCapabilities?.();
  if (!capabilities) {
    setTorchAvailable(false);
    return;
  }
  const advanced: MediaTrackConstraints & { torch?: boolean; focusMode?: string } = {};
  if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes("continuous")) {
    (advanced as any).focusMode = "continuous";
  }
  if (Array.isArray((capabilities as any).exposureMode) && (capabilities as any).exposureMode.includes("continuous")) {
    (advanced as any).exposureMode = "continuous";
  }
  if (capabilities.zoom) {
    const desired = clamp(2, capabilities.zoom.min ?? 1, capabilities.zoom.max ?? 4);
    advanced.zoom = desired;
  }
  if ("torch" in capabilities && typeof capabilities.torch === "boolean") {
    setTorchAvailable(true);
    (advanced as any).torch = torchOn;
  } else {
    setTorchAvailable(false);
  }
  if (Object.keys(advanced).length === 0) return;
  try {
    await track.applyConstraints({ advanced: [advanced] });
  } catch (err) {
    console.warn("Unable to apply advanced constraints", err);
  }
}
