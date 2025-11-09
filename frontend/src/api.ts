import axios from 'axios';
import type { Product, ProductFormValues } from './types';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api';

const client = axios.create({
  baseURL,
});

export async function fetchInventory(): Promise<Product[]> {
  const response = await client.get<Product[]>('/inventory/');
  return response.data;
}

export async function scanInbound(payload: ProductFormValues): Promise<Product> {
  const response = await client.post<Product>('/inventory/scan/inbound', {
    ...payload,
    cost_price: payload.cost_price ? Number(payload.cost_price) : undefined,
    sale_price: payload.sale_price ? Number(payload.sale_price) : undefined,
  });
  return response.data;
}

export async function scanOutbound(barcode: string): Promise<Product> {
  const response = await client.post<Product>(`/inventory/scan/outbound/${barcode}`);
  return response.data;
}
