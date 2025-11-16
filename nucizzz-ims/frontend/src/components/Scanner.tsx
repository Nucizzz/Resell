import React, { useEffect, useMemo, useRef, useState } from "react";
import Quagga, { type QuaggaJSResultObject } from "@ericblade/quagga2";
import { DetectedPayload, Symbology, normalizeGTIN, sanitizeCode, isValidBarcode, symbologyFromResult } from "../utils/barcode";

const ROI = { top: "18%", right: "10%", left: "10%", bottom: "18%" } as const;
const DETECTION_WINDOW_MS = 3500;
const DECAY_MS = 1500;
const MIN_CONFIDENCE = 0.6;
const HIGH_CONF_STREAK = 3;
const MIN_HITS = 6;
const RUNNER_HIT_GAP = 3;
const RUNNER_DELTA = 0.15;
const COOLDOWN_MS = 900;
const MOTION_PAUSE_MS = 500;
const ZXING_FORMATS = ["EAN_13", "UPC_A"];

const BASE_READERS = ["ean_reader", "upc_reader"] as const;
const CODE128_READER = ["code_128_reader"] as const;

export type ScannerProps = {
  onDetected: (payload: DetectedPayload) => void | Promise<void>;
  onError?: (message: string) => void;
  enableCode128?: boolean;
  onStatus?: (status: { light: number; stability: number; roiFill: number }) => void;
  zxingReader?: any;
};

type DetectionHit = { code: string; symbology: Symbology; confidence: number; timestamp: number };
type Candidate = { code: string; symbology: Symbology; hits: number; meanConfidence: number };

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);

async function loadZXing(): Promise<any | null> {
  try {
    const mod = await import("@zxing/browser");
    return new mod.BrowserMultiFormatReader();
  } catch (err) {
    console.warn("ZXing not available", err);
    return null;
  }
}

function cropToROI(video: HTMLVideoElement, scale = 1) {
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight) return null;
  const top = (parseInt(ROI.top) / 100) * videoHeight;
  const bottom = videoHeight - (parseInt(ROI.bottom) / 100) * videoHeight;
  const left = (parseInt(ROI.left) / 100) * videoWidth;
  const right = videoWidth - (parseInt(ROI.right) / 100) * videoWidth;
  const width = (right - left) * scale;
  const height = (bottom - top) * scale;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(
    video,
    left,
    top,
    right - left,
    bottom - top,
    0,
    0,
    width,
    height
  );
  return canvas;
}

function roiStats(box?: number[][]): number {
  if (!box || box.length < 4) return 0;
  const xs = box.map((b) => b[0]);
  const ys = box.map((b) => b[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const area = width * height;
  return area;
}

function shouldAccept(candidate?: Candidate, runner?: Candidate, streak = 0) {
  if (!candidate) return false;
  const hitDominance = runner ? candidate.hits - runner.hits >= RUNNER_HIT_GAP : true;
  const confDominance = runner ? candidate.meanConfidence - runner.meanConfidence >= RUNNER_DELTA : true;
  const strong = candidate.hits >= MIN_HITS && candidate.meanConfidence >= MIN_CONFIDENCE;
  const streakStrong = streak >= HIGH_CONF_STREAK;
  return (strong && (hitDominance || confDominance)) || streakStrong;
}

export { shouldAccept };

export default function Scanner({ onDetected, onError, enableCode128, onStatus, zxingReader }: ScannerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const detectionHistory = useRef<DetectionHit[]>([]);
  const lastConfirmed = useRef<{ code: string; ts: number } | null>(null);
  const lastResultRef = useRef<string>("");
  const streakRef = useRef<{ code: string; count: number }>({ code: "", count: 0 });
  const motionPause = useRef<number>(0);
  const activeTrack = useRef<MediaStreamTrack | null>(null);
  const [status, setStatus] = useState("Allinea il barcode al centro");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torch, setTorch] = useState(false);
  const [lightLevel, setLightLevel] = useState(0.6);
  const [stability, setStability] = useState(1);
  const [roiFill, setRoiFill] = useState(0);
  const [deviceId, setDeviceId] = useState<string | undefined>(() => localStorage.getItem("scanner.camera") || undefined);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [ready, setReady] = useState(false);
  const [viewMode, setViewMode] = useState<"standard" | "wide">("standard");

  const videoAspectClass =
    viewMode === "wide"
      ? "aspect-[3/2] sm:aspect-video lg:aspect-[21/9]"
      : "aspect-[4/5] sm:aspect-[4/3] lg:aspect-video";

  const readers = useMemo(() => (enableCode128 ? CODE128_READER : BASE_READERS), [enableCode128]);

  useEffect(() => {
    let cancelled = false;
    const onMotion = (ev: DeviceMotionEvent) => {
      const accel = ev.accelerationIncludingGravity;
      const rotation = ev.rotationRate;
      const magnitude = Math.abs(accel?.x ?? 0) + Math.abs(accel?.y ?? 0) + Math.abs(accel?.z ?? 0);
      const rot = Math.abs(rotation?.alpha ?? 0) + Math.abs(rotation?.beta ?? 0) + Math.abs(rotation?.gamma ?? 0);
      const unstable = magnitude > 30 || rot > 90;
      setStability((prev) => clamp(unstable ? prev * 0.7 : prev + 0.05));
      if (unstable) motionPause.current = Date.now() + MOTION_PAUSE_MS;
    };
    window.addEventListener("devicemotion", onMotion, { passive: true });
    return () => {
      cancelled = true;
      window.removeEventListener("devicemotion", onMotion);
      try {
        Quagga.stop();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      onStatus?.({ light: lightLevel, stability, roiFill });
    }, 300);
    return () => clearInterval(interval);
  }, [lightLevel, stability, roiFill, onStatus]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    let cancelled = false;
    async function loadDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const videos = devices
          .filter((d) => d.kind === "videoinput")
          .map((d, idx) => ({ id: d.deviceId, label: d.label || `Camera ${idx + 1}` }));
        setCameras(videos);
        if (!deviceId && videos.length > 0) {
          setDeviceId(videos[0].id);
        }
      } catch (err) {
        console.warn("Unable to enumerate cameras", err);
      }
    }
    loadDevices();
    const handleDeviceChange = () => loadDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", handleDeviceChange);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener?.("devicechange", handleDeviceChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!containerRef.current) return;
      setStatus("Accensione fotocamera...");
      setReady(false);
      setTorchAvailable(false);
      try {
        const constraints: MediaTrackConstraints = {
          facingMode: { ideal: "environment" },
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
        };
        await Quagga.stop();
        await new Promise<void>((resolve, reject) => {
          Quagga.init(
            {
              inputStream: {
                type: "LiveStream",
                constraints,
                target: containerRef.current!,
                area: ROI,
              },
              locator: { patchSize: "medium", halfSample: true },
              decoder: { readers: readers as any },
              locate: true,
              frequency: 6,
              numOfWorkers:
                typeof navigator !== "undefined" && navigator.hardwareConcurrency
                  ? Math.max(1, navigator.hardwareConcurrency - 1)
                  : 2,
            },
            (err) => {
              if (err) return reject(err);
              resolve();
            }
          );
        });
        if (cancelled) return;
        Quagga.start();
        setReady(true);
        setStatus("Allinea il barcode nella fascia centrale");
        const track = (Quagga as any)?.CameraAccess?.getActiveTrack?.();
        if (track) {
          try {
            await track.applyConstraints({ advanced: [{ focusMode: "continuous", exposureMode: "continuous" }] } as any);
          } catch {}
          activeTrack.current = track;
          const torchCap = (track.getCapabilities?.() as any)?.torch;
          setTorchAvailable(Boolean(torchCap));
          if (!torchCap && torch) setTorch(false);
          const stream = track.getSettings?.();
          if (stream?.deviceId) localStorage.setItem("scanner.camera", stream.deviceId);
        }
        const video = containerRef.current?.querySelector("video");
        if (video) {
          Object.assign(video.style, {
            width: "100%",
            height: "100%",
            objectFit: "cover",
          });
        }
      } catch (err: any) {
        console.error("Quagga init failed", err);
        if (!cancelled) onError?.(err?.message || "Impossibile avviare lo scanner");
      }
    }
    start();
    return () => {
      cancelled = true;
      try {
        Quagga.offDetected(handleDetected);
        Quagga.stop();
      } catch {}
      activeTrack.current?.stop?.();
      activeTrack.current = null;
      setTorchAvailable(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, readers]);

  useEffect(() => {
    if (!ready) return;
    Quagga.onDetected(handleDetected);
    return () => {
      Quagga.offDetected(handleDetected);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    const track = activeTrack.current;
    if (!track || !torchAvailable) return;
    async function applyTorch() {
      try {
        await track.applyConstraints({ advanced: [{ torch }] } as any);
      } catch (err) {
        console.warn("Torch toggle failed", err);
        setTorch(false);
      }
    }
    applyTorch();
  }, [torch, torchAvailable]);

  const handleDetected = (result: QuaggaJSResultObject) => {
    if (Date.now() < motionPause.current) return;
    const raw = result?.codeResult?.code;
    const confidence = typeof result?.codeResult?.confidence === "number" ? result.codeResult.confidence : 0;
    const digits = sanitizeCode(raw);
    if (!digits || confidence < MIN_CONFIDENCE || !isValidBarcode(digits)) return;

    const now = Date.now();
    detectionHistory.current = detectionHistory.current.filter((hit) => now - hit.timestamp <= DETECTION_WINDOW_MS);
    const symbology = symbologyFromResult(result?.codeResult?.format, digits);
    detectionHistory.current.push({ code: digits, symbology, confidence, timestamp: now });

    if (lastConfirmed.current && now - lastConfirmed.current.ts < COOLDOWN_MS) return;

    if (lastResultRef.current === digits && confidence < MIN_CONFIDENCE + 0.05) return;
    lastResultRef.current = digits;

    if (confidence >= 0.75) {
      if (streakRef.current.code === digits) {
        streakRef.current = { code: digits, count: streakRef.current.count + 1 };
      } else {
        streakRef.current = { code: digits, count: 1 };
      }
    } else {
      streakRef.current = { code: digits, count: 0 };
    }

    const summary = summarize(now);
    setRoiFill(() => {
      const area = roiStats(result?.box);
      return clamp(area / ((result?.frameSize?.x || 1) * (result?.frameSize?.y || 1)));
    });
    if (shouldAccept(summary.candidate, summary.runnerUp, summary.streak)) {
      finalize(summary.candidate);
    } else {
      setStatus(
        `Sto verificando ${summary.candidate?.code || digits} (${summary.candidate?.hits || 1}/$${MIN_HITS})…`
      );
    }
    measureLight();
  };

  const summarize = (now: number): { candidate?: Candidate; runnerUp?: Candidate; streak: number } => {
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
    const ranked: Candidate[] = Array.from(buckets.entries())
      .map(([code, data]) => ({ code, hits: data.hits, meanConfidence: data.weighted / Math.max(data.weight, 0.0001), symbology: data.symbology }))
      .sort((a, b) => b.hits - a.hits || b.meanConfidence - a.meanConfidence);
    return { candidate: ranked[0], runnerUp: ranked[1], streak: streakRef.current.count };
  };

  const measureLight = () => {
    const video = containerRef.current?.querySelector("video");
    if (!video) return;
    const canvas = cropToROI(video, 0.5);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }
    const avg = sum / (data.length / 4) / 255;
    setLightLevel(avg);
    if (avg < 0.25) setStatus("Luce bassa: avvicina o attiva la torcia");
  };

  const finalize = async (candidate?: Candidate) => {
    if (!candidate) return;
    lastConfirmed.current = { code: candidate.code, ts: Date.now() };
    detectionHistory.current = [];
    setStatus("Verifica finale…");
    try {
      const verified = await verifyCandidate(candidate.code);
      const finalCode = verified || candidate.code;
      const normalized = normalizeGTIN(candidate.symbology, finalCode);
      navigator.vibrate?.(30);
      await onDetected({ raw: finalCode, symbology: candidate.symbology, normalized });
      setStatus("Pronto per una nuova scansione");
    } catch (err: any) {
      console.error("Finalize detection error", err);
      onError?.("Errore durante la verifica del barcode");
    }
  };

  const verifyCandidate = async (code: string): Promise<string | null> => {
    const video = containerRef.current?.querySelector("video");
    if (!video) return null;
    const canvas = cropToROI(video, 1.5);
    if (!canvas) return null;

    const reader = zxingReader || (await loadZXing());
    if (reader?.decodeFromImage)
      try {
        const dataUrl = canvas.toDataURL("image/png");
        const res = await reader.decodeFromImageUrl(dataUrl, {
          hints: { TRY_HARDER: true, POSSIBLE_FORMATS: ZXING_FORMATS },
        });
        if (res?.getText) {
          const normalized = sanitizeCode(res.getText());
          if (normalized === code || normalized === `0${code}` || `0${normalized}` === code) return normalized;
        }
      } catch (err) {
        console.warn("ZXing verification failed", err);
      }

    return new Promise((resolve) => {
      Quagga.decodeSingle(
        {
          inputStream: { size: 1920, singleChannel: false },
          locator: { patchSize: "large", halfSample: false },
          decoder: { readers: BASE_READERS as any },
          src: canvas.toDataURL(),
        },
        (res) => {
          const candidate = sanitizeCode(res?.codeResult?.code);
          resolve(candidate || null);
        }
      );
    });
  };

  const cycleCamera = () => {
    if (!cameras.length) return;
    const currentIdx = deviceId ? cameras.findIndex((c) => c.id === deviceId) : -1;
    const next = cameras[(currentIdx + 1) % cameras.length];
    if (next) {
      setDeviceId(next.id);
      localStorage.setItem("scanner.camera", next.id);
      setTorch(false);
      setTorchAvailable(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-black/90 text-white">
        <div ref={containerRef} className={`relative w-full bg-black ${videoAspectClass}`} />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <div className="h-32 w-full max-w-2xl rounded-3xl border-2 border-white/50 sm:h-40 lg:h-48" />
        </div>
        <div className="absolute left-3 top-3 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
          {enableCode128 ? "Sessione CODE128" : "EAN-13 / UPC"}
        </div>
        <div className="absolute right-3 top-3 flex flex-col items-end gap-2 text-xs">
          <button
            type="button"
            className="rounded-full bg-white/20 px-3 py-1"
            onClick={() => setViewMode((m) => (m === "wide" ? "standard" : "wide"))}
          >
            {viewMode === "wide" ? "Vista compatta" : "Vista larga"}
          </button>
          {cameras.length > 1 && (
            <button
              type="button"
              className="rounded-full bg-white/20 px-3 py-1"
              onClick={cycleCamera}
            >
              Cambia camera
            </button>
          )}
          {torchAvailable && (
            <button
              type="button"
              className="rounded-full bg-white/20 px-3 py-1"
              onClick={() => setTorch((t) => !t)}
            >
              {torch ? "Torcia ON" : "Torcia OFF"}
            </button>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-sm">
          {status}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">Stabilità</span>
            <span>{Math.round(stability * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${clamp(stability) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">Luce</span>
            <span>{Math.round(lightLevel * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${clamp(lightLevel) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">ROI fill</span>
            <span>{Math.round(roiFill * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${clamp(roiFill) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
