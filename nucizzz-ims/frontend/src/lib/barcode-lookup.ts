// Database barcode reale - usa Open Product Data e altre fonti
// Open Food Facts: database mondiale di prodotti alimentari e non
// Barcode Lookup: database commerciale alternativo

export interface BarcodeProductInfo {
  title?: string;
  description?: string;
  brand?: string;
  image_url?: string;
  category?: string;
  weight?: number;
  price?: number;
}

export async function lookupBarcode(barcode: string): Promise<BarcodeProductInfo | null> {
  // Prova prima con Open Food Facts (database più completo, gratuito)
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Nucizzz-IMS/1.0',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.status === 1 && data.product) {
        const product = data.product;
        // Estrai informazioni in modo più completo
        const title = product.product_name || 
                     product.product_name_it || 
                     product.product_name_en || 
                     product.product_name_fr ||
                     product.product_name_de ||
                     undefined;
        
        const description = product.generic_name || 
                           product.generic_name_it || 
                           product.generic_name_en ||
                           product.ingredients_text ||
                           undefined;
        
        const brand = product.brands || 
                     product.brand || 
                     product.brands_tags?.[0] ||
                     undefined;
        
        const imageUrl = product.image_url || 
                        product.image_front_url || 
                        product.image_front_small_url ||
                        product.image_small_url ||
                        undefined;
        
        // Estrai peso se disponibile
        let weight: number | undefined;
        if (product.product_quantity) {
          const weightMatch = product.product_quantity.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l)/i);
          if (weightMatch) {
            weight = parseFloat(weightMatch[1]);
            const unit = weightMatch[2].toLowerCase();
            if (unit === 'kg' || unit === 'l') {
              weight = weight * 1000; // Converti in grammi/ml
            }
          }
        }
        
        if (title || brand) {
          return {
            title: title || undefined,
            description: description || undefined,
            brand: brand || undefined,
            image_url: imageUrl || undefined,
            category: product.categories || product.categories_tags?.[0] || undefined,
            weight: weight,
          };
        }
      }
    }
  } catch (e) {
    console.warn("Open Food Facts API error:", e);
  }

  // Prova con Open Product Data (alternativa per prodotti non alimentari)
  try {
    const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`, {
      method: 'GET',
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.code === 'OK' && data.items && data.items.length > 0) {
        const item = data.items[0];
        return {
          title: item.title || item.description || undefined,
          description: item.description || undefined,
          brand: item.brand || item.manufacturer || undefined,
          image_url: item.images?.[0] || undefined,
          category: item.category || undefined,
        };
      }
    }
  } catch (e) {
    console.warn("UPC Item DB API error:", e);
  }

  // Se nessuna API funziona, ritorna null
  return null;
}

