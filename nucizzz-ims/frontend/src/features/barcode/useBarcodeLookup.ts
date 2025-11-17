import { useState } from "react";
import { LookupProductDTO, LookupSource } from "./types";

type State = "idle" | "loading" | "found" | "empty" | "error";

type Detail = {
  source?: LookupSource;
  code?: string;
  message?: string;
  debug?: any;
};

export function useBarcodeLookup() {
  const [state, setState] = useState<State>("idle");
  const [detail, setDetail] = useState<Detail>({});
  const [data, setData] = useState<LookupProductDTO | null>(null);

  async function lookup(rawCode: string) {
    const code = rawCode.trim();
    if (!code) return;
    if (!/^\d{8,14}$/.test(code)) {
      setState("error");
      setDetail({ code: "INVALID_BARCODE", message: "Formato barcode non valido" });
      setData(null);
      return;
    }
    setState("loading");
    setDetail({});
    setData(null);
    try {
      const res = await fetch(`/api/barcode/${encodeURIComponent(code)}`);
      const body = await res.json().catch(() => ({}));
      if (res.ok && body?.status === "FOUND") {
        setState("found");
        setData(body.data);
        setDetail({ source: body.data?.source, debug: body.debug });
        return;
      }
      if (res.ok && body?.status === "NOT_FOUND") {
        setState("empty");
        setDetail({ debug: body.debug });
        return;
      }
      const errorDetail = body?.detail || body;
      setState("error");
      setDetail({
        code: errorDetail?.code || "SERVER_ERROR",
        message: errorDetail?.message || "Errore imprevedibile",
        debug: errorDetail?.debug,
      });
    } catch (err: any) {
      setState("error");
      setDetail({ code: "NETWORK_ERROR", message: err?.message ?? "Errore di rete" });
    }
  }

  return { state, detail, data, lookup };
}
