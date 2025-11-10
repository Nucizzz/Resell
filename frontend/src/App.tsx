import React, { useState } from 'react'
import Scanner from './components/Scanner'
import { api } from './api'

function Receive() {
  const [form, setForm] = useState({ barcode: '', title: '', size: '', price_eur: 0 })
  const [msg, setMsg] = useState<string | null>(null)

  async function submit() {
    const res = await api.post('/products/receive', form)
    setMsg('Prodotto salvato e sincronizzato su Shopify: #' + res.data.id)
  }

  return (
    <div className="card space-y-3">
      <h2 className="text-xl font-semibold">Ricezione merce</h2>
      <Scanner onDetected={(code) => setForm(f => ({ ...f, barcode: code }))} />
      <div className="grid gap-2">
        <input className="input" placeholder="Barcode" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
        <input className="input" placeholder="Titolo" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <input className="input" placeholder="Taglia" value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} />
        <input className="input" placeholder="Prezzo EUR" type="number" step="0.01" value={form.price_eur} onChange={e => setForm({ ...form, price_eur: parseFloat(e.target.value) })} />
      </div>
      <button className="btn bg-black text-white" onClick={submit}>Salva & Sincronizza</button>
      {msg && <p className="text-green-600">{msg}</p>}
    </div>
  )
}

function Sell() {
  const [barcode, setBarcode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  async function sell() {
    const res = await api.post('/products/sell', { barcode })
    setMsg('Venduto: ' + res.data.title + ' — stock Shopify aggiornato.')
  }
  return (
    <div className="card space-y-3">
      <h2 className="text-xl font-semibold">Vendita</h2>
      <Scanner onDetected={(code) => setBarcode(code)} />
      <input className="input" placeholder="Barcode" value={barcode} onChange={e => setBarcode(e.target.value)} />
      <button className="btn bg-black text-white" onClick={sell}>Vendi</button>
      {msg && <p className="text-green-600">{msg}</p>}
    </div>
  )
}

function Setup() {
  const [shop, setShop] = useState('')
  const [token, setToken] = useState('')
  const [location, setLocation] = useState('')

  async function testSave() {
    const res = await api.post('/shopify/setup', { shop, access_token: token, location_id: location || null })
    setLocation(res.data.location_id)
    alert('OK! Location ID: ' + res.data.location_id + '\nInseriscilo nel file .env come SHOPIFY_LOCATION_ID e riavvia lo stack.')
  }

  return (
    <div className="card space-y-3">
      <h2 className="text-xl font-semibold">Setup Shopify</h2>
      <input className="input" placeholder="shop.myshopify.com" value={shop} onChange={e => setShop(e.target.value)} />
      <input className="input" placeholder="Admin API access token" value={token} onChange={e => setToken(e.target.value)} />
      <input className="input" placeholder="Location ID (opz.)" value={location} onChange={e => setLocation(e.target.value)} />
      <button className="btn bg-black text-white" onClick={testSave}>Test & Save</button>
      <p className="text-sm text-gray-600">Dopo il test, copia SHOPIFY_SHOP, SHOPIFY_ACCESS_TOKEN e SHOPIFY_LOCATION_ID in .env e riavvia.</p>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<'receive'|'sell'|'setup'>('receive')
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Nucizzz IMS</h1>
      <div className="flex gap-2">
        <button className={`btn ${tab==='receive'?'bg-black text-white':'bg-gray-100'}`} onClick={()=>setTab('receive')}>Ricezione</button>
        <button className={`btn ${tab==='sell'?'bg-black text-white':'bg-gray-100'}`} onClick={()=>setTab('sell')}>Vendita</button>
        <button className={`btn ${tab==='setup'?'bg-black text-white':'bg-gray-100'}`} onClick={()=>setTab('setup')}>Setup</button>
      </div>
      {tab==='receive' && <Receive />}
      {tab==='sell' && <Sell />}
      {tab==='setup' && <Setup />}
    </div>
  )
}
