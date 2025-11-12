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

export default function Scanner({ onDetected, onError }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [torch, setTorch] = useState(false);

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
        setDeviceId(cams[0]?.deviceId);
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
    if (!containerRef.current || !deviceId) return;
    let mounted = true;

    async function start() {
      try {
        const constraints: MediaTrackConstraints = {
          facingMode: { ideal: "environment" },
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        };

        // prova a settare la torcia (non tutti i browser lo supportano)
        if (torch) {
          (constraints as any).advanced = [{ torch: true }];
        }

        await navigator.mediaDevices.getUserMedia({ video: constraints });

        Quagga.init(
          {
            inputStream: {
              type: "LiveStream",
              target: containerRef.current,
              constraints,
            },
            decoder: { readers: SCAN_READERS as any },
            locate: true,
            numOfWorkers: navigator.hardwareConcurrency
              ? Math.min(4, navigator.hardwareConcurrency)
              : 2,
          },
          (err: unknown) => {
            if (!mounted) return;
            if (err) {
              console.error(err);
              const msg = "Errore inizializzazione scanner";
              setError(msg);
              onError?.(msg);
              return;
            }
            Quagga.start();
            setActive(true);
          }
        );

        const detected = (data: any) => {
          const code = data?.codeResult?.code;
          if (code) {
            onDetected(code);
            // fermiamo dopo una lettura per evitare doppi insert
            Quagga.stop();
            setActive(false);
          }
        };
        Quagga.onDetected(detected);
      } catch (e: any) {
        console.error(e);
        const msg = e?.message || "Impossibile accedere alla fotocamera";
        setError(msg);
        onError?.(msg);
      }
    }

    start();

    return () => {
      try {
        Quagga.offDetected(() => {});
        Quagga.stop();
      } catch {}
    };
  }, [onDetected, deviceId, torch]);

  return (
    <div className="card space-y-2">
      <div className="flex gap-2 items-center">
        <select
          className="input"
          value={deviceId || ""}
          onChange={(e) => setDeviceId(e.target.value || undefined)}
        >
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
            </option>
          ))}
        </select>
        <button className="btn bg-gray-100" onClick={() => setTorch((t) => !t)}>
          {torch ? "Torcia: ON" : "Torcia: OFF"}
        </button>
        {!active && <span className="text-xs text-gray-600">In attesa…</span>}
      </div>

      <div
        ref={containerRef}
        style={{ width: "100%", minHeight: 320, position: "relative" }}
      />

      {!active && !error && (
        <p className="text-sm text-gray-600">
          Consenti la fotocamera e inquadra il codice a barre (EAN/UPC/Code128).
        </p>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
