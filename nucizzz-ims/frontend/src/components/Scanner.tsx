// frontend/src/components/Scanner.tsx
import React, { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";

type Props = {
  onDetected: (code: string) => void;
  onError?: (message: string) => void;
};

const SCAN_READERS = [
  "ean_reader",
  "ean_8_reader",
  "upc_reader",
  "upc_e_reader",
  "code_128_reader",
];

type DetectionHit = {
  code: string;
  ts: number;
  confidence: number;
};

const DETECTION_WINDOW_MS = 3500;
const MIN_CONFIRMATIONS = 3;
const CONFIDENCE_THRESHOLD = 0.15;

export default function Scanner({ onDetected, onError }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [torch, setTorch] = useState(false);
  const [status, setStatus] = useState("Scanner fermo");
  const detectionHistory = useRef<DetectionHit[]>([]);
  const handlerRef = useRef<((data: any) => void) | null>(null);
  const lockedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    async function enumerateCameras() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        const all = await navigator.mediaDevices.enumerateDevices();
        const cams = all.filter((d) => d.kind === "videoinput");
        if (!mounted) return;
        setDevices(cams);
        // preferisci camera esterna: evita label che contengono "Integrated" o "Front"
        const preferred =
          cams.find((c) => /usb|external|rear|environment/i.test(c.label)) ||
          cams.find((c) => !/integrated|front/i.test(c.label)) ||
          cams[cams.length - 1];
        setDeviceId(preferred?.deviceId);
        stream.getTracks().forEach((t) => t.stop());
      } catch (e) {
        console.warn("No camera permission yet:", e);
      }
    }
    enumerateCameras();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !active) return;
    let mounted = true;
    let userStream: MediaStream | null = null;

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
        } else {
          userStream = await navigator.mediaDevices.getUserMedia({ video: constraints });
        }

        if (!mounted || !containerRef.current) {
          userStream?.getTracks().forEach(track => track.stop());
          return;
        }

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

    start();

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
      } catch (e) {
        console.warn("Error cleaning up scanner:", e);
      }
    };
  }, [onDetected, deviceId, torch, active]);

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
