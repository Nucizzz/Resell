export type LookupSource = "OPEN" | "RAPIDAPI";

export type LookupProductDTO = {
  barcode: string;
  name?: string;
  brand?: string;
  category?: string;
  description?: string;
  images?: string[];
  quantity?: string;
  packaging?: string;
  countryOrigin?: string;
  attributes?: Record<string, string | number | boolean>;
  source?: LookupSource;
  raw?: unknown;
};
