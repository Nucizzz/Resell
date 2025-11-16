// Opzionalmente importa questo componente se preferisci usare ZXing al posto di Quagga.
// Richiede l'installazione della dipendenza: npm install @zxing/browser
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  type Result,
} from "@zxing/browser";
import type { ScannerProps } from "./Scanner";
import { DETECTION_WINDOW_MS, MIN_CONFIRMATIONS } from "./Scanner";

const ACCEPTED_LENGTHS = new Set([8, 12, 13]);
const sanitize = (value: string | undefined | null) => (value ? value.replace(/[^0-9]/g, "") : "");
const isNumeric = (value: string) => /^\d+$/.test(value);

const checksum13 = (code: string) => {
  const digits = code.split("").map(Number);
  const check = digits.pop() ?? 0;
  const sum = digits.reduce((acc, digit, idx) => acc + digit * (idx % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === check;
};
const checksum8 = (code: string) => {
  const digits = code.split("").map(Number);
  const check = digits.pop() ?? 0;
  const sum = digits.reduce((acc, digit, idx) => acc + digit * (idx % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
};
const checksum12 = (code: string) => {
  const digits = code.split("").map(Number);
  const check = digits.pop() ?? 0;
  const odd = digits.reduce((acc, digit, idx) => acc + (idx % 2 === 0 ? digit : 0), 0);
  const even = digits.reduce((acc, digit, idx) => acc + (idx % 2 === 1 ? digit : 0), 0);
  return (10 - ((odd * 3 + even) % 10)) % 10 === check;
};
const isValid = (code: string) => {
  if (!code || !isNumeric(code) || !ACCEPTED_LENGTHS.has(code.length)) return false;
  if (code.length === 13) return checksum13(code);
  if (code.length === 12) return checksum12(code);
  return checksum8(code);
};

export default function ScannerZXing({ onDetected, onError, enableCode128 }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const detectionHits = useRef<Map<string, number[]>>(new Map());
  const [status, setStatus] = useState("Allinea il barcode nella fascia centrale");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [running, setRunning] = useState(true);

  const hints = useMemo(() => {
    const map = new Map();
    const formats = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E];
    if (enableCode128) formats.push(BarcodeFormat.CODE_128);
    map.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    map.set(DecodeHintType.TRY_HARDER, true);
    return map;
  }, [enableCode128]);

  useEffect(() => {
    let active = true;
    async function enumerate() {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
        const all = await navigator.mediaDevices.enumerateDevices();
        if (!active) return;
        const cams = all.filter((item) => item.kind === "videoinput");
        setDevices(cams);
        if (!deviceId && cams.length) {
          const preferred =
            cams.find((c) => /rear|environment|back/i.test(c.label)) || cams.find((c) => /usb|external/i.test(c.label)) || cams[0];
          setDeviceId(preferred?.deviceId || "");
        }
      } catch (err) {
        console.warn("ZXing camera permission", err);
      }
    }
    enumerate();
    return () => {
      active = false;
    };
  }, [deviceId]);

  useEffect(() => {
    if (!running || !videoRef.current) {
      stopReader();
      return;
    }
    const reader = new BrowserMultiFormatReader(hints);
    readerRef.current = reader;
    detectionHits.current.clear();
    setStatus("Inizializzo la camera…");

    reader
      .decodeFromConstraints(
        {
          video: {
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: { ideal: "environment" },
            deviceId: deviceId ? { exact: deviceId } : undefined,
          },
        },
        videoRef.current,
        (result, err) => {
          if (result) {
            handleResult(result);
          } else if (err && err.name !== "NotFoundException") {
            console.warn("ZXing error", err);
          }
        }
      )
      .catch((err) => {
        console.error("ZXing init error", err);
        onError?.("Impossibile avviare lo scanner ZXing");
      })
      .finally(() => setStatus("Allinea il barcode nella fascia"));

    return () => {
      reader.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, hints, running]);

  const handleResult = (result: Result) => {
    const text = sanitize(result?.getText?.() ?? "");
    if (!isValid(text)) return;
    const now = Date.now();
    pruneHits(now);
    const bucket = detectionHits.current.get(text) ?? [];
    bucket.push(now);
    detectionHits.current.set(text, bucket.filter((ts) => now - ts <= DETECTION_WINDOW_MS));
    const confirmations = detectionHits.current.get(text)?.length ?? 0;
    if (confirmations >= MIN_CONFIRMATIONS) {
      detectionHits.current.clear();
      setStatus("Verifica finale…");
      recheckFrame(text)
        .then((finalCode) => {
          if (finalCode) {
            onDetected(finalCode);
          }
        })
        .catch((err) => {
          console.warn("ZXing recheck error", err);
          onError?.("Errore durante la verifica finale");
          onDetected(text);
        })
        .finally(() => setStatus("Allinea il barcode nella fascia"));
    } else {
      setStatus(`Sto verificando ${text} (${confirmations}/${MIN_CONFIRMATIONS})…`);
    }
  };

  const recheckFrame = async (fallback: string): Promise<string | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return fallback;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fallback;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const result = await readerRef.current?.decodeFromImageUrl(dataUrl);
      const next = sanitize(result?.getText?.() ?? "");
      return next && isValid(next) ? next : fallback;
    } catch (err) {
      console.warn("ZXing decodeSingle error", err);
      return fallback;
    }
  };

  const pruneHits = (now: number) => {
    for (const [code, hits] of detectionHits.current.entries()) {
      const recent = hits.filter((ts) => now - ts <= DETECTION_WINDOW_MS);
      if (recent.length) detectionHits.current.set(code, recent);
      else detectionHits.current.delete(code);
    }
  };

  const stopReader = () => {
    readerRef.current?.reset();
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => setRunning((prev) => !prev)}>
          {running ? "Metti in pausa" : "Riattiva scanner"}
        </button>
        {devices.length > 1 && (
          <select className="input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            {devices.map((cam) => (
              <option key={cam.deviceId} value={cam.deviceId}>
                {cam.label || "Fotocamera"}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="relative w-full overflow-hidden rounded-2xl bg-black aspect-[3/2]">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-[30%] bg-black/60" />
          <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-black/60" />
          <div className="absolute top-[30%] bottom-[30%] left-0 w-[10%] bg-black/60" />
          <div className="absolute top-[30%] bottom-[30%] right-0 w-[10%] bg-black/60" />
          <div className="absolute top-[30%] bottom-[30%] left-[10%] right-[10%] rounded-xl border-2 border-white/80" />
        </div>
      </div>
      <p className="text-sm text-gray-700 min-h-[1.5rem]">{status}</p>
    </div>
  );
}
