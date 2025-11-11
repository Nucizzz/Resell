import React, { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { api } from '../lib/api'

export const ReceivePage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [barcode, setBarcode] = useState('')
  const [form, setForm] = useState<any>({ name:'', brand:'', category:'', size:'', price:0, cost:0, quantity:1, description:'', image_url:'' })

  // Start scanner
  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader()
    let active = true
    ;(async () => {
      try {
        const video = videoRef.current!
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        const deviceId = devices[0]?.deviceId
        if (!deviceId) return
        await codeReader.decodeFromVideoDevice(deviceId, video, (result, err) => {
          if (!active) return
          if (result) {
            setBarcode(result.getText())
          }
        })
      } catch { /* ignore */ }
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (barcode) {
      // Precompila tramite lookup
      api.get(`/lookup/${barcode}`).then(({data})=> {
        setForm((f:any)=>({...f, name: data.name || f.name, brand: data.brand || f.brand, category: data.category || f.category, image_url: data.image_url || f.image_url }))
      }).catch(()=>{})
    }
  }, [barcode])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { ...form, sku: barcode || form.sku }
    await api.post('/products', payload)
    alert('Prodotto inserito')
    setForm({ name:'', brand:'', category:'', size:'', price:0, cost:0, quantity:1, description:'', image_url:'' })
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await api.post('/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    setForm((f:any)=>({ ...f, image_url: data.url }))
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl shadow p-3">
        <h3 className="font-semibold mb-2">Scanner</h3>
        <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video" />
        <div className="mt-2 text-sm">Barcode rilevato: <b>{barcode}</b></div>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl shadow p-3 space-y-2">
        <h3 className="font-semibold">Nuovo prodotto</h3>
        <input className="border rounded px-2 py-1 w-full" placeholder="Nome" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
        <div className="grid grid-cols-2 gap-2">
          <input className="border rounded px-2 py-1 w-full" placeholder="Brand" value={form.brand} onChange={e=>setForm({...form, brand:e.target.value})} />
          <input className="border rounded px-2 py-1 w-full" placeholder="Categoria" value={form.category} onChange={e=>setForm({...form, category:e.target.value})} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input className="border rounded px-2 py-1 w-full" placeholder="Taglia" value={form.size} onChange={e=>setForm({...form, size:e.target.value})} />
          <input className="border rounded px-2 py-1 w-full" type="number" step="0.01" placeholder="Prezzo" value={form.price} onChange={e=>setForm({...form, price:parseFloat(e.target.value)})} />
          <input className="border rounded px-2 py-1 w-full" type="number" step="0.01" placeholder="Costo" value={form.cost} onChange={e=>setForm({...form, cost:parseFloat(e.target.value)})} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className="border rounded px-2 py-1 w-full" type="number" placeholder="Quantità" value={form.quantity} onChange={e=>setForm({...form, quantity:parseInt(e.target.value)})} />
          <input className="border rounded px-2 py-1 w-full" placeholder="SKU (se diverso da barcode)" value={form.sku||''} onChange={e=>setForm({...form, sku:e.target.value})} />
        </div>
        <textarea className="border rounded px-2 py-1 w-full" placeholder="Descrizione" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} />
        <div className="flex items-center gap-2">
          <input type="file" onChange={onFile} />
          {form.image_url && <img src={form.image_url} className="w-12 h-12 object-cover rounded" />}
        </div>
        <button className="px-3 py-2 rounded bg-black text-white">Salva</button>
      </form>
    </div>
  )
}