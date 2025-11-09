export interface Product {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  brand?: string | null;
  size?: string | null;
  colorway?: string | null;
  condition: string;
  cost_price?: number | null;
  sale_price?: number | null;
  listed: boolean;
  is_sold: boolean;
  shopify_product_id?: string | null;
  shopify_inventory_item_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductFormValues {
  sku: string;
  barcode: string;
  name: string;
  brand?: string;
  size?: string;
  colorway?: string;
  condition: string;
  cost_price?: string;
  sale_price?: string;
}
