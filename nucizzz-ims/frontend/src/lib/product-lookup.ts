import { api } from "../api";

export type ProductEnrichment = {
  found: boolean;
  source?: "OFF" | "OBF" | "OPF" | "SPIDER";
  gtin: string;
  title?: string | null;
  brand?: string | null;
  categories?: string[];
  image?: { url: string; width?: number; height?: number; credits?: string };
  description?: string | null;
};

export async function lookupProduct(gtin: string): Promise<ProductEnrichment> {
  if (!gtin) {
    return { found: false, gtin };
  }
  const res = await api.get("/products/lookup", { params: { barcode: gtin } });
  return res.data;
}

