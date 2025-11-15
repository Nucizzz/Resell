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
  const [stabilizing, setStabilizing] = useState(false);
  const pendingCodeRef = useRef<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        // Risoluzione ridotta per performance migliori
        const constraints: MediaTrackConstraints = {
          facingMode: { ideal: "environment" },
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 640, max: 640 },
          height: { ideal: 480, max: 480 },
          frameRate: { ideal: 15, max: 20 },
        };

        // prova a settare la torcia (non tutti i browser lo supportano)
        if (torch) {
          (constraints as any).advanced = [{ torch: true }];
        }

        // Se deviceId non è ancora disponibile, prova comunque
        if (!deviceId) {
          // Usa constraints senza deviceId specifico - risoluzione ridotta
          userStream = await navigator.mediaDevices.getUserMedia({ 
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 640, max: 640 },
              height: { ideal: 480, max: 480 },
              frameRate: { ideal: 15, max: 20 },
            }
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
                width: { ideal: 640, max: 640 },
                height: { ideal: 480, max: 480 },
                frameRate: { ideal: 15, max: 20 },
              },
            },
            decoder: { readers: SCAN_READERS as any },
            locate: true,
            numOfWorkers: 1, // Ridotto a 1 per performance migliori
            frequency: 10, // Controlla ogni 10 frame invece di ogni frame
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
            } catch (startErr) {
              console.error("Quagga start error:", startErr);
              userStream?.getTracks().forEach(track => track.stop());
            }
          }
        );

        const finalizeDetection = (code: string) => {
          try {
            Quagga.stop();
          } catch {}
          try {
            Quagga.offDetected(detected);
          } catch {}
          if (userStream) {
            userStream.getTracks().forEach((track) => {
              track.stop();
              track.enabled = false;
            });
          }
          pendingCodeRef.current = null;
          if (confirmTimerRef.current) {
            clearTimeout(confirmTimerRef.current);
            confirmTimerRef.current = null;
          }
          setStabilizing(false);
          setActive(false);
          setTimeout(() => onDetected(code), 100);
        };

        const detected = (data: any) => {
          if (!mounted) return;
          const code = data?.codeResult?.code;
          if (!code) return;
          setStabilizing(true);
          if (pendingCodeRef.current && pendingCodeRef.current !== code) {
            pendingCodeRef.current = code;
          } else if (!pendingCodeRef.current) {
            pendingCodeRef.current = code;
          }
          if (confirmTimerRef.current) {
            clearTimeout(confirmTimerRef.current);
          }
          confirmTimerRef.current = setTimeout(() => {
            if (pendingCodeRef.current) {
              finalizeDetection(pendingCodeRef.current);
            }
          }, 1800);
        };
        Quagga.onDetected(detected);
      } catch (e: any) {
        if (!mounted) return;
        console.error(e);
        const msg = e?.message || "Impossibile accedere alla fotocamera";
        setError(msg);
        onError?.(msg);
        userStream?.getTracks().forEach(track => track.stop());
      }
    }

    start();

    return () => {
      mounted = false;
      try {
        // Rimuovi listener
        Quagga.offDetected(() => {});
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
      pendingCodeRef.current = null;
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
      setStabilizing(false);
    };
  }, [onDetected, deviceId, torch, active]);

  return (
    <div className="card space-y-2">
      <div className="flex gap-2 items-center flex-wrap">
        {!active && (
          <button className="btn" onClick={() => setActive(true)}>
            Scansiona
          </button>
        )}
        {active && (
          <>
            <button className="btn bg-gray-100" onClick={() => setTorch((t) => !t)}>
              {torch ? "Torcia: ON" : "Torcia: OFF"}
            </button>
            <button className="btn bg-red-100" onClick={() => setActive(false)}>
              Stop
            </button>
          </>
        )}
      </div>

      {active && (
        <div
          ref={containerRef}
          style={{ width: "100%", minHeight: 120, position: "relative", borderRadius: 12, overflow: "hidden", background: "#000" }}
        />
      )}

      {!active && !error && (
        <p className="text-sm text-gray-600">
          Premi "Scansiona" per usare la fotocamera posteriore.
        </p>
      )}
      {active && stabilizing && (
        <p className="text-xs text-blue-600">
          Sto stabilizzando la lettura, attendi un attimo…
        </p>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
