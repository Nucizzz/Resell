export interface BarcodeProductInfo {
  title?: string;
  description?: string;
  brand?: string;
  image_url?: string;
  category?: string;
  weight?: number;
  quantity?: string;
  source?: "OPEN" | "RAPIDAPI";
}

export async function lookupBarcode(barcode: string): Promise<BarcodeProductInfo | null> {
  if (!/^\d{8,14}$/.test(barcode)) {
    return null;
  }

  try {
    const response = await fetch(`/api/barcode/${encodeURIComponent(barcode)}?nocache=1`);
    const body = await response.json().catch(() => ({}));

    if (response.ok && body?.status === "FOUND") {
      const data = body.data ?? {};
      const images: string[] | undefined = Array.isArray(data.images) ? data.images : undefined;
      let weight: number | undefined;
      if (typeof data.quantity === "string") {
        const match = data.quantity.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l)/i);
        if (match) {
          weight = parseFloat(match[1]);
          const unit = match[2].toLowerCase();
          if (unit === "kg" || unit === "l") {
            weight *= 1000;
          }
        }
      }

      return {
        title: data.name || undefined,
        description: data.description || undefined,
        brand: data.brand || undefined,
        image_url: images?.[0],
        category: data.category || undefined,
        quantity: data.quantity || undefined,
        weight,
        source: data.source,
      };
    }

    if (response.ok && body?.status === "NOT_FOUND") {
      return null;
    }

    console.warn("Barcode lookup error:", body?.detail || body);
  } catch (error) {
    console.warn("Barcode lookup request failed:", error);
  }

  return null;
}
