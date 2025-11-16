import axios from "axios";

const raw = import.meta.env.VITE_API_BASE || "/api";
let base = raw;
try {
  const loc = window.location;
  if (raw.startsWith("http://") && loc.protocol === "https:") {
    base = "https://" + raw.substring("http://".length);
  }
} catch {}

export const api = axios.create({ baseURL: base });
