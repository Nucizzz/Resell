import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchInventory, scanInbound, scanOutbound } from './api';
import { ScannerInput } from './components/ScannerInput';
import { ProductTable } from './components/ProductTable';
import type { Product, ProductFormValues } from './types';

function App() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductFormValues>({
    sku: '',
    barcode: '',
    name: '',
    brand: '',
    size: '',
    colorway: '',
    condition: 'new',
    cost_price: '',
    sale_price: '',
  });
  const [outboundBarcode, setOutboundBarcode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [outboundError, setOutboundError] = useState<string | null>(null);

  const inventoryQuery = useQuery<Product[]>({
    queryKey: ['inventory'],
    queryFn: fetchInventory,
  });

  const inboundMutation = useMutation({
    mutationFn: scanInbound,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setForm({
        sku: '',
        barcode: '',
        name: '',
        brand: '',
        size: '',
        colorway: '',
        condition: 'new',
        cost_price: '',
        sale_price: '',
      });
    },
  });

  const outboundMutation = useMutation({
    mutationFn: scanOutbound,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setOutboundBarcode('');
    },
  });

  const handleInboundSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.barcode || !form.sku || !form.name) {
      setFormError('Inserisci almeno barcode, SKU e nome prodotto.');
      return;
    }
    setFormError(null);
    inboundMutation.mutate(form);
  };

  const handleOutboundSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!outboundBarcode) {
      setOutboundError('Scansiona o inserisci un barcode valido.');
      return;
    }
    setOutboundError(null);
    outboundMutation.mutate(outboundBarcode);
  };

  return (
    <div className="app-shell">
      <header>
        <div>
          <h1>Nucizzz Inventory Control</h1>
          <p>Scanner-friendly gestionale for sneakers & streetwear reselling.</p>
        </div>
      </header>

      <div className="grid">
        <section className="card">
          <h2>Inbound Scan</h2>
          <p>Compila i campi oppure scansiona direttamente il barcode nel relativo input.</p>
          <form className="grid" onSubmit={handleInboundSubmit} style={{ gridTemplateColumns: '1fr' }}>
            <ScannerInput
              label="Barcode"
              value={form.barcode}
              onChange={(value) => setForm((prev) => ({ ...prev, barcode: value }))}
            />
            <ScannerInput
              label="SKU interno"
              value={form.sku}
              onChange={(value) => setForm((prev) => ({ ...prev, sku: value }))}
            />
            <ScannerInput
              label="Nome prodotto"
              value={form.name}
              onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
            />
            <ScannerInput
              label="Brand"
              value={form.brand}
              onChange={(value) => setForm((prev) => ({ ...prev, brand: value }))}
            />
            <ScannerInput
              label="Taglia"
              value={form.size}
              onChange={(value) => setForm((prev) => ({ ...prev, size: value }))}
            />
            <ScannerInput
              label="Colorway"
              value={form.colorway}
              onChange={(value) => setForm((prev) => ({ ...prev, colorway: value }))}
            />
            <label>
              Condizione
              <select
                value={form.condition}
                onChange={(event) => setForm((prev) => ({ ...prev, condition: event.target.value }))}
              >
                <option value="new">Deadstock</option>
                <option value="used">Used</option>
              </select>
            </label>
            <ScannerInput
              label="Prezzo di acquisto"
              value={form.cost_price}
              onChange={(value) => setForm((prev) => ({ ...prev, cost_price: value }))}
              type="number"
            />
            <ScannerInput
              label="Prezzo di vendita"
              value={form.sale_price}
              onChange={(value) => setForm((prev) => ({ ...prev, sale_price: value }))}
              type="number"
            />
            <button className="primary" type="submit" disabled={inboundMutation.isPending}>
              {inboundMutation.isPending ? 'Invio...' : 'Registra e pubblica su Shopify'}
            </button>
            {(formError || inboundMutation.isError) && (
              <p style={{ color: '#b91c1c' }}>
                {formError ?? (inboundMutation.error as Error).message}
              </p>
            )}
            {inboundMutation.isSuccess && <p style={{ color: '#15803d' }}>Prodotto pubblicato!</p>}
          </form>
        </section>

        <section className="card">
          <h2>Outbound Scan</h2>
          <p>Scansiona il barcode del prodotto venduto per chiudere l&apos;ordine.</p>
          <form onSubmit={handleOutboundSubmit}>
            <ScannerInput
              label="Barcode"
              value={outboundBarcode}
              onChange={setOutboundBarcode}
            />
            <button className="primary" type="submit" disabled={outboundMutation.isPending}>
              {outboundMutation.isPending ? 'Aggiorno...' : 'Segna come venduto'}
            </button>
            {(outboundError || outboundMutation.isError) && (
              <p style={{ color: '#b91c1c' }}>
                {outboundError ?? (outboundMutation.error as Error).message}
              </p>
            )}
            {outboundMutation.isSuccess && <p style={{ color: '#15803d' }}>Inventario aggiornato.</p>}
          </form>
        </section>
      </div>

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Inventario</h2>
          <button className="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ['inventory'] })}>
            Aggiorna
          </button>
        </div>
        <ProductTable products={inventoryQuery.data ?? []} isLoading={inventoryQuery.isLoading} />
      </section>
    </div>
  );
}

export default App;
