import React, { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";

type Props = { onDetected: (code: string) => void };

const SCAN_READERS = [
  "ean_reader", // EAN-13 (retail EU)
  "ean_8_reader", // EAN-8
  "upc_reader", // UPC-A (retail US)
  "upc_e_reader", // UPC-E
  "code_128_reader", // molto comune su etichette / SKU
];

export default function Scanner({ onDetected }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;

    async function start() {
      try {
        // chiedi permesso fotocamera (utile su iOS/Android)
        await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });

        Quagga.init(
          {
            inputStream: {
              type: "LiveStream",
              target: containerRef.current, // div che conterrà video/canvas
              constraints: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            },
            decoder: {
              readers: SCAN_READERS as any,
            },
            locate: true,
            numOfWorkers: navigator.hardwareConcurrency
              ? Math.min(4, navigator.hardwareConcurrency)
              : 2,
          },
          (err: unknown) => {
            if (!mounted) return;
            if (err) {
              console.error(err);
              setError("Errore inizializzazione scanner");
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
            // UX: stoppa dopo una lettura
            Quagga.stop();
            setActive(false);
          }
        };

        Quagga.onDetected(detected);
      } catch (e: unknown) {
        console.error(e);
        setError(
          e instanceof Error
            ? e.message
            : "Impossibile accedere alla fotocamera"
        );
      }
    }

    start();

    return () => {
      mounted = false;
      try {
        Quagga.offDetected(() => {});
        Quagga.stop();
      } catch {}
    };
  }, [onDetected]);

  return (
    <div className="card space-y-2">
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
