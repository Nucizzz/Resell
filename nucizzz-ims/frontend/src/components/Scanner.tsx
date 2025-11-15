import React, { useEffect, useMemo, useRef, useState } from "react";
import Quagga, { type QuaggaJSResultObject } from "@ericblade/quagga2";

export type ScannerProps = {
  onDetected: (code: string) => void | Promise<void>;
  onError?: (message: string) => void;
  enableCode128?: boolean;
};

const BASE_READERS = ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader"] as const;

export const DETECTION_WINDOW_MS = 3000;
export const MIN_CONFIRMATIONS = 5;
export const CONFIDENCE_THRESHOLD = 0.32;
const FRAME_FREQUENCY = 6;
const DEFAULT_STATUS = "Allinea il barcode nella fascia centrale";
const ACCEPTED_LENGTHS = new Set([8, 12, 13]);

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
  const detectionHits = useRef<Map<string, number[]>>(new Map());
  const finalizingRef = useRef(false);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
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
    detectionHits.current.clear();
    finalizingRef.current = false;

    const initConfig = {
      inputStream: {
        type: "LiveStream" as const,
        target: containerRef.current,
        constraints: {
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: { ideal: "environment" },
          deviceId: deviceId ? { exact: deviceId } : undefined,
        },
        area: { top: "30%", right: "10%", left: "10%", bottom: "30%" },
      },
      decoder: { readers },
      locator: { patchSize: "large" as const, halfSample: false },
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
        pruneHits(now);
        const bucket = detectionHits.current.get(digits) ?? [];
        bucket.push(now);
        detectionHits.current.set(digits, bucket.filter((ts) => now - ts <= DETECTION_WINDOW_MS));
        const confirmations = detectionHits.current.get(digits)?.length ?? 0;

        if (confirmations >= MIN_CONFIRMATIONS) {
          finalizeDetection(digits);
        } else {
          setStatus(`Sto verificando ${digits} (${confirmations}/${MIN_CONFIRMATIONS})…`);
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
    for (const [code, hits] of detectionHits.current.entries()) {
      const recent = hits.filter((ts) => now - ts <= DETECTION_WINDOW_MS);
      if (recent.length) {
        detectionHits.current.set(code, recent);
      } else {
        detectionHits.current.delete(code);
      }
    }
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
    detectionHits.current.clear();
    setStatus("Verifica finale…");
    try {
      const verified = await recheckCandidate(candidate);
      const finalCode = verified || candidate;
      if (finalCode) {
        navigator.vibrate?.(30);
        await onDetected(finalCode);
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
  };

  const onDeviceChange = (value: string) => {
    setDeviceId(value);
    detectionHits.current.clear();
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
          <div className="absolute top-0 left-0 right-0 h-[30%] bg-black/60" />
          <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-black/60" />
          <div className="absolute top-[30%] bottom-[30%] left-0 w-[10%] bg-black/60" />
          <div className="absolute top-[30%] bottom-[30%] right-0 w-[10%] bg-black/60" />
          <div className="absolute top-[30%] bottom-[30%] left-[10%] right-[10%] border-2 border-white/80 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.7)]" />
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
