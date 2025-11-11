import React, { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
} from "@zxing/library";

type Props = { onDetected: (code: string) => void };

function isValidRetailCode(raw: string): boolean {
  const code = (raw || "").replace(/\D/g, "");
  if (!code) return false;
  if (![8, 12, 13].includes(code.length)) return false;
  if (code.length === 13) {
    const d = code.split("").map((n) => parseInt(n));
    const sum = d
      .slice(0, 12)
      .reduce((acc, n, i) => acc + n * (i % 2 ? 3 : 1), 0);
    const chk = (10 - (sum % 10)) % 10;
    return chk === d[12];
  }
  if (code.length === 12) {
    const d = ("0" + code).split("").map((n) => parseInt(n));
    const sum = d
      .slice(0, 12)
      .reduce((acc, n, i) => acc + n * (i % 2 ? 3 : 1), 0);
    const chk = (10 - (sum % 10)) % 10;
    return chk === d[12];
  }
  if (code.length === 8) {
    const d = code.split("").map((n) => parseInt(n));
    const sum = d
      .slice(0, 7)
      .reduce((acc, n, i) => acc + n * (i % 2 ? 3 : 1), 0);
    const chk = (10 - (sum % 10)) % 10;
    return chk === d[7];
  }
  return false;
}

export default function Scanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.UPC_A,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_E,
    ]);
    reader.hints = hints;
    reader.timeBetweenDecodingAttempts = 250;

    let stopped = false;

    async function start() {
      try {
        const devices = (
          await navigator.mediaDevices.enumerateDevices()
        ).filter((d) => d.kind === "videoinput");
        const back =
          devices.find((d) => (d.label || "").toLowerCase().includes("back")) ||
          devices[0];
        if (!videoRef.current) return;
        setRunning(true);
        reader.decodeFromVideoDevice(
          back?.deviceId,
          videoRef.current,
          (result, err) => {
            if (stopped) return;
            if (result) {
              const text = result.getText();
              if (isValidRetailCode(text)) {
                onDetected(text.replace(/\D/g, ""));
                reader.reset();
                setRunning(false);
                stopped = true;
              }
            }
          }
        );
      } catch (e: any) {
        setError(e?.message || "Errore accesso fotocamera");
      }
    }
    start();

    return () => {
      try {
        reader.reset();
      } catch {}
    };
  }, [onDetected]);

  return (
    <div className="card space-y-2">
      <video ref={videoRef} className="w-full rounded-xl" />
      {!running && !error && (
        <p className="text-sm text-gray-600">
          Consenti la fotocamera e inquadra il barcode (EAN/UPC).
        </p>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
