import type { Product } from '../types';

interface Props {
  products: Product[];
  isLoading: boolean;
}

export function ProductTable({ products, isLoading }: Props) {
  if (isLoading) {
    return <p>Carico l&apos;inventario...</p>;
  }

  if (products.length === 0) {
    return <p>Nessun prodotto registrato ancora.</p>;
  }

  const currency = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Barcode</th>
            <th>SKU</th>
            <th>Nome</th>
            <th>Brand</th>
            <th>Taglia</th>
            <th>Prezzo</th>
            <th>Status</th>
            <th>Shopify</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>{product.barcode}</td>
              <td>{product.sku}</td>
              <td>{product.name}</td>
              <td>{product.brand ?? '—'}</td>
              <td>{product.size ?? '—'}</td>
              <td>{product.sale_price ? currency.format(product.sale_price) : '—'}</td>
              <td>
                <span className={`badge ${product.is_sold ? 'sold' : 'inbound'}`}>
                  <span className={`status-dot ${product.is_sold ? 'sold' : 'available'}`} />
                  {product.is_sold ? 'Venduto' : 'Disponibile'}
                </span>
              </td>
              <td>{product.shopify_product_id ? 'Pubblicato' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
