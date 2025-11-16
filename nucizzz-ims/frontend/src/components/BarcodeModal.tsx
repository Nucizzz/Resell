import React, { useEffect, useMemo, useRef, useState } from "react";
import { Camera, RefreshCw, Zap, X } from "lucide-react";
import { createScanner, Scanner } from "../lib/scanner";
import "../styles/scanner.css";
import { useLocation } from "react-router-dom";

type BarcodeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
  focusRef?: React.RefObject<HTMLInputElement>;
  title?: string;
  description?: string;
};

const DEVICE_STORAGE_KEY = "ims.scanner.deviceId";

const facingHint = (label: string) => {
  const lower = label.toLowerCase();
  if (/front|user|selfie|facetime/.test(lower)) return "front";
  if (/back|rear|environment|world/.test(lower)) return "back";
  return null;
};

const readableName = (device: MediaDeviceInfo, index: number) => {
  if (device.label) return device.label;
  return `Fotocamera ${index + 1}`;
};

export default function BarcodeModal({
  open,
  onOpenChange,
  onDetected,
  focusRef,
  title = "Scanner barcode",
  description = "Inquadra il codice nel riquadro e mantieni fermo il dispositivo",
}: BarcodeModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const roiRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const scannerRef = useRef<Scanner | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(DEVICE_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [starting, setStarting] = useState(false);
  const [facingPref, setFacingPref] = useState<"environment" | "user">("environment");
  const location = useLocation();

  useEffect(() => {
    if (!scannerRef.current) {
      scannerRef.current = createScanner();
    }
    scannerRef.current.onCode((code) => {
      setError(null);
      onDetected(code);
    });
  }, [onDetected]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        const active = document.activeElement as HTMLElement | null;
        const tag = active?.tagName?.toLowerCase();
        const editable = active?.getAttribute?.("contenteditable");
        const isField = tag === "input" || tag === "textarea" || editable === "true";
        if (isField) return;
        event.preventDefault();
        onOpenChange(true);
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onOpenChange]);

  const stopScanner = () => {
    scannerRef.current?.stop();
    setTorchOn(false);
    setTorchAvailable(false);
  };

  const refreshTorchState = () => {
    if (scannerRef.current) {
      setTorchAvailable(scannerRef.current.supportsTorch());
    } else {
      setTorchAvailable(false);
    }
  };

  const startScanner = async (override?: { deviceId?: string | null; facingMode?: "environment" | "user" }) => {
    if (!open) return;
    if (!scannerRef.current) {
      scannerRef.current = createScanner();
    }
    const scanner = scannerRef.current;
    const video = videoRef.current;
    if (!video) return;
    const roi = roiRef.current?.getBoundingClientRect();
    const videoRect = video.getBoundingClientRect();
    setStarting(true);
    setStatus("Avvio camera...");
    setError(null);
    setTorchOn(false);
    setTorchAvailable(false);
    try {
      const hasOverrideDevice = override && Object.prototype.hasOwnProperty.call(override, "deviceId");
      const deviceId = hasOverrideDevice ? override?.deviceId ?? undefined : selectedDeviceId ?? undefined;
      const facingMode = override?.facingMode ?? facingPref;
      await scanner.start(video, { deviceId, facingMode, roi: roi ?? undefined, videoRect });
      refreshTorchState();
      setStatus("");
    } catch (err: any) {
      console.error("Scanner start error", err);
      stopScanner();
      setError(err?.message || "Impossibile avviare la fotocamera. Controlla i permessi o la connessione HTTPS.");
      setStatus("");
    } finally {
      setStarting(false);
    }
  };

  const loadDevices = async (): Promise<string | null> => {
    if (!scannerRef.current) {
      scannerRef.current = createScanner();
    }
    try {
      const list = await scannerRef.current.listVideoInputs();
      setDevices(list);
      let resolved: string | null = selectedDeviceId;
      if (list.length) {
        const stored =
          selectedDeviceId && list.some((d) => d.deviceId === selectedDeviceId)
            ? selectedDeviceId
            : list[0].deviceId;
        if (stored !== selectedDeviceId) {
          setSelectedDeviceId(stored);
        }
        resolved = stored;
        try {
          localStorage.setItem(DEVICE_STORAGE_KEY, stored);
        } catch {
          // ignore
        }
      }
      return resolved;
    } catch (err: any) {
      setError(err?.message || "Non è stato possibile ottenere la lista delle fotocamere.");
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!open) {
      stopScanner();
      if (focusRef?.current) {
        focusRef.current.focus();
      } else {
        lastFocusedRef.current?.focus();
      }
      return;
    }
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    setStatus("Avvio camera...");
    setError(null);
    setTorchOn(false);
    (async () => {
      const id = await loadDevices();
      if (!cancelled) {
        await startScanner({ deviceId: id ?? undefined });
      }
    })();

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        stopScanner();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    return () => {
      stopScanner();
    };
  }, [location.pathname, open]);

  const handleDeviceChange = async (deviceId: string) => {
    if (!deviceId) {
      setSelectedDeviceId(null);
      await startScanner({ deviceId: null });
      return;
    }
    setSelectedDeviceId(deviceId);
    try {
      localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
    } catch {
      // ignore storage errors
    }
    if (!scannerRef.current) return;
    setTorchOn(false);
    setTorchAvailable(false);
    if (!scannerRef.current.isActive()) {
      await startScanner({ deviceId });
      return;
    }
    setStarting(true);
    setStatus("Cambio fotocamera...");
    try {
      await scannerRef.current.switchDevice(deviceId);
      refreshTorchState();
      setStatus("");
    } catch (err: any) {
      console.error("Switch device error", err);
      setError(err?.message || "Cambio fotocamera non riuscito.");
      await startScanner({ deviceId });
    } finally {
      setStarting(false);
    }
  };

  const handleInvert = async () => {
    if (devices.length > 1 && selectedDeviceId) {
      const currentFacing = facingHint(devices.find((d) => d.deviceId === selectedDeviceId)?.label || "");
      const front = devices.find((d) => facingHint(d.label || "") === "front");
      const back = devices.find((d) => facingHint(d.label || "") === "back");
      const target =
        currentFacing === "front"
          ? back?.deviceId
          : currentFacing === "back"
          ? front?.deviceId
          : devices.find((d) => d.deviceId !== selectedDeviceId)?.deviceId;
      if (target && target !== selectedDeviceId) {
        await handleDeviceChange(target);
        return;
      }
    }
    const nextFacing = facingPref === "environment" ? "user" : "environment";
    setFacingPref(nextFacing);
    await startScanner({ facingMode: nextFacing, deviceId: null });
  };

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    const next = !torchOn;
    const success = await scannerRef.current.setTorch(next);
    if (success) {
      setTorchOn(next);
    }
  };

  const deviceOptions = useMemo(() => {
    return devices.map((device, index) => ({
      id: device.deviceId || `device-${index}`,
      label: readableName(device, index),
    }));
  }, [devices]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-6">
        <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold">{title}</div>
              <p className="text-xs text-gray-500">{description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Camera className="h-4 w-4 text-gray-500" />
                <select
                  className="input h-9"
                  value={selectedDeviceId ?? ""}
                  onChange={(e) => handleDeviceChange(e.target.value)}
                  disabled={!deviceOptions.length || starting}
                >
                  {deviceOptions.length === 0 && <option value="">Nessuna fotocamera</option>}
                  {deviceOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn bg-gray-100 text-gray-700"
                onClick={handleInvert}
                disabled={starting}
              >
                <RefreshCw className="h-4 w-4" />
                <span className="ml-1">Inverti</span>
              </button>
            <button
              className="btn"
              onClick={() => onOpenChange(false)}
              autoFocus
            >
              <X className="h-4 w-4" />
              <span className="ml-2">Annulla</span>
            </button>
          </div>
          </div>
          <div className="flex flex-col items-center gap-4 p-4">
            <div className="scan-frame">
              <video ref={videoRef} className="scan-video" />
              <div ref={roiRef} className="scan-roi" />
            </div>
            {status && <p className="text-xs text-gray-500">{status}</p>}
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
              <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1">
                <Zap className="h-3 w-3" />
                Visione computer
              </span>
              {torchAvailable && (
                <button
                  type="button"
                  className="rounded-full bg-black px-3 py-1 text-white transition hover:bg-gray-800"
                  onClick={toggleTorch}
                >
                  {torchOn ? "Torcia ON" : "Torcia OFF"}
                </button>
              )}
            </div>
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
