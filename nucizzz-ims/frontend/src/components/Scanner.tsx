import React, { useEffect, useMemo, useRef, useState } from "react";
import Quagga, { type QuaggaJSResultObject } from "@ericblade/quagga2";

export type ScannerProps = {
  onDetected: (code: string) => void | Promise<void>;
  onError?: (message: string) => void;
  enableCode128?: boolean;
};

const BASE_READERS = ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader"] as const;

type DetectionHit = {
  code: string;
  ts: number;
  confidence: number;
};

const DETECTION_WINDOW_MS = 3500;
const MIN_CONFIRMATIONS = 3;
const CONFIDENCE_THRESHOLD = 0.15;

export const DETECTION_WINDOW_MS = 3000;
export const MIN_CONFIRMATIONS = 5;
export const CONFIDENCE_THRESHOLD = 0.32;
const FRAME_FREQUENCY = 6;
const DEFAULT_STATUS = "Allinea il barcode nella fascia centrale";
const ACCEPTED_LENGTHS = new Set([8, 12, 13]);
const REPEAT_COOLDOWN_MS = 1200;

type DetectionHit = { code: string; timestamp: number; confidence: number };
type DetectionSummary = { code: string; count: number; avgConfidence: number };

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
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [torch, setTorch] = useState(false);
  const [status, setStatus] = useState("Scanner fermo");
  const detectionHistory = useRef<DetectionHit[]>([]);
  const handlerRef = useRef<((data: any) => void) | null>(null);
  const lockedRef = useRef(false);

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

    async function start() {
      try {
        setStatus("Accensione fotocamera…");
        // Risoluzione ridotta per performance migliori
        const constraints: MediaTrackConstraints = {
          facingMode: { ideal: "environment" },
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 960, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 15, max: 24 },
        };

        // prova a settare la torcia (non tutti i browser lo supportano)
        if (torch) {
          (constraints as any).advanced = [{ torch: true }];
        }

        // Se deviceId non è ancora disponibile, prova comunque
        if (!deviceId) {
          // Usa constraints senza deviceId specifico
          userStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 960, max: 1280 },
              height: { ideal: 720, max: 720 },
              frameRate: { ideal: 15, max: 24 },
            },
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

        // Pulisci eventuali istanze precedenti
        try {
          Quagga.stop();
        } catch {}

        Quagga.init(
          {
            inputStream: {
              type: "LiveStream",
              target: containerRef.current,
              constraints: deviceId ? constraints : {
                facingMode: { ideal: "environment" },
                width: { ideal: 960, max: 1280 },
                height: { ideal: 720, max: 720 },
                frameRate: { ideal: 15, max: 24 },
              },
              area: { top: "20%", right: "15%", left: "15%", bottom: "20%" },
            },
            decoder: { readers: SCAN_READERS as any },
            locator: { patchSize: "medium", halfSample: true },
            locate: true,
            numOfWorkers: typeof navigator !== "undefined" && navigator.hardwareConcurrency
              ? Math.min(2, navigator.hardwareConcurrency)
              : 1,
            frequency: 4,
          },
          (err: unknown) => {
            if (!mounted) {
              userStream?.getTracks().forEach(track => track.stop());
              return;
            }
            if (err) {
              console.error("Quagga init error:", err);
              const msg = "Errore inizializzazione scanner";
              setError(msg);
              onError?.(msg);
              userStream?.getTracks().forEach(track => track.stop());
              return;
            }
            try {
              Quagga.start();
              setStatus("Allinea il barcode al riquadro centrale e tienilo fermo qualche secondo.");
            } catch (startErr) {
              console.error("Quagga start error:", startErr);
              userStream?.getTracks().forEach(track => track.stop());
            }
          }
        );

        const detected = (data: any) => {
          if (!mounted || lockedRef.current) return;
          const code = data?.codeResult?.code;
          const confidence = typeof data?.codeResult?.confidence === "number"
            ? data.codeResult.confidence
            : 0;
          if (!code) return;

          const now = Date.now();
          detectionHistory.current = detectionHistory.current.filter((hit) => now - hit.ts < DETECTION_WINDOW_MS);
          detectionHistory.current.push({ code, confidence, ts: now });

          const confirmations = detectionHistory.current.filter(
            (hit) => hit.code === code && hit.confidence >= CONFIDENCE_THRESHOLD,
          ).length;

          if (confirmations >= MIN_CONFIRMATIONS) {
            lockedRef.current = true;
            setStatus(`Codice confermato (${code}).`);
            try {
              Quagga.offDetected(detected);
              if (handlerRef.current === detected) {
                handlerRef.current = null;
              }
              Quagga.stop();
            } catch {}

            if (userStream) {
              userStream.getTracks().forEach((track) => {
                track.stop();
                track.enabled = false;
              });
            }

            setTimeout(() => {
              setActive(false);
              onDetected(code);
            }, 150);
          } else {
            setStatus(`Sto verificando ${code} (${confirmations}/${MIN_CONFIRMATIONS})…`);
          }
        };
        handlerRef.current = detected;
        Quagga.onDetected(detected);
      } catch (e: any) {
        if (!mounted) return;
        console.error(e);
        const msg = e?.message || "Impossibile accedere alla fotocamera";
        setError(msg);
        onError?.(msg);
        setStatus("Errore fotocamera");
        userStream?.getTracks().forEach(track => track.stop());
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

    return () => {
      mounted = false;
      try {
        // Rimuovi listener
        if (handlerRef.current) {
          Quagga.offDetected(handlerRef.current);
          handlerRef.current = null;
        }
        // Ferma Quagga
        Quagga.stop();
        // Ferma lo stream video
        if (userStream) {
          userStream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
          });
          userStream = null;
        }
        // Ferma anche lo stream video se esiste nel DOM
        if (containerRef.current) {
          const video = containerRef.current.querySelector('video');
          if (video && video.srcObject) {
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach(track => {
              track.stop();
              track.enabled = false;
            });
            video.srcObject = null;
          }
          // Pulisci anche il canvas se esiste
          const canvas = containerRef.current.querySelector('canvas');
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
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

  const startScan = () => {
    detectionHistory.current = [];
    lockedRef.current = false;
    setError(null);
    setStatus("Preparazione scanner…");
    setActive(true);
  };

  const stopScan = () => {
    setActive(false);
    setStatus("Scanner fermo");
  };

  const changeDevice = (value: string) => {
    setDeviceId(value || undefined);
  };

  return (
    <div className="card space-y-2">
      <div className="flex gap-2 items-center flex-wrap">
        {!active && (
          <button className="btn" onClick={startScan}>
            Scansiona
          </button>
        )}
        {active && (
          <>
            <button className="btn bg-gray-100" onClick={() => setTorch((t) => !t)}>
              {torch ? "Torcia: ON" : "Torcia: OFF"}
            </button>
            <button className="btn bg-red-100" onClick={stopScan}>
              Stop
            </button>
          </>
        )}
      </div>

      {devices.length > 1 && (
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          <span>Fotocamera</span>
          <select
            className="input"
            value={deviceId || ""}
            onChange={(e) => changeDevice(e.target.value)}
            disabled={active}
          >
            <option value="">Automatica</option>
            {devices.map((cam, idx) => (
              <option key={cam.deviceId || idx} value={cam.deviceId}>
                {cam.label || `Camera ${idx + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}

      {active && (
        <div
          ref={containerRef}
          style={{ width: "100%", minHeight: 120, position: "relative", borderRadius: 12, overflow: "hidden", background: "#000" }}
        />
      )}

      <p className="text-sm text-gray-600 min-h-[1.5rem]">{status}</p>
      {error && <p className="text-red-600">{error}</p>}
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
