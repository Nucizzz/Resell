import React, { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { api, setApiKey } from '../lib/api'
export const ReceivePage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [barcode,setBarcode]=useState(''); const [err,setErr]=useState<string|null>(null)
  const [devices,setDevices]=useState<MediaDeviceInfo[]>([]); const [deviceId,setDeviceId]=useState('')
  const [form,setForm]=useState<any>({ name:'', brand:'', category:'', size:'', price:0, cost:0, quantity:1, description:'', image_url:'', sku:'' })
  useEffect(()=>{ const k=localStorage.getItem('ims_api_key')||''; if(k) setApiKey(k) },[])
  const start=async(id?:string)=>{
    setErr(null); const reader=new BrowserMultiFormatReader()
    try{
      if(location.protocol!=='https:' && location.hostname!=='localhost'){ setErr('La fotocamera richiede HTTPS (usa https:// o sviluppa in localhost)'); return }
      const list=await BrowserMultiFormatReader.listVideoInputDevices(); setDevices(list)
      const target=id||list.find(d=>/back|rear|environment/i.test(d.label))?.deviceId||list[0]?.deviceId
      if(!target){ setErr('Nessuna fotocamera disponibile o permesso negato'); return }
      setDeviceId(target)
      await reader.decodeFromVideoDevice(target, videoRef.current!, (result, e)=>{ if(result) setBarcode(result.getText()) })
    }catch(e:any){ setErr(e?.message||'Errore avvio fotocamera') }
  }
  useEffect(()=>{ start() },[])
  useEffect(()=>{ if(!barcode) return; api.get(`/lookup/${barcode}`).then(({data})=> setForm((f:any)=>({...f, sku:barcode, name:data.name||f.name, brand:data.brand||f.brand, category:data.category||f.category, image_url:data.image_url||f.image_url }))).catch(()=>{}) },[barcode])
  const submit=async(e:React.FormEvent)=>{ e.preventDefault(); const payload={...form, sku: form.sku||barcode}; await api.post('/products',payload); alert('Prodotto inserito'); setForm({ name:'', brand:'', category:'', size:'', price:0, cost:0, quantity:1, description:'', image_url:'', sku:'' }); setBarcode('') }
  const onFile=async(e:React.ChangeEvent<HTMLInputElement>)=>{ const file=e.target.files?.[0]; if(!file) return; const fd=new FormData(); fd.append('file',file); const {data}=await api.post('/upload-image',fd,{headers:{'Content-Type':'multipart/form-data'}}); setForm((f:any)=>({...f,image_url:data.url})) }
  return (<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div className="bg-white rounded-xl shadow p-3"><h3 className="font-semibold mb-2">Scanner</h3><video ref={videoRef} className="w-full rounded-lg bg-black aspect-video"/>{err?<div className="mt-2 text-red-600 text-sm">{err}</div>:<div className="mt-2 text-sm">Barcode: <b>{barcode}</b></div>}{devices.length>1&&(<div className="mt-2"><select className="border rounded px-2 py-1" value={deviceId} onChange={e=>start(e.target.value)}>{devices.map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||'camera'}</option>)}</select></div>)}</div>
    <form onSubmit={submit} className="bg-white rounded-xl shadow p-3 space-y-2"><h3 className="font-semibold">Nuovo prodotto</h3>
      <input className="border rounded px-2 py-1 w-full" placeholder="Barcode/SKU" value={form.sku||barcode} onChange={e=>setForm({...form, sku:e.target.value})}/>
      <input className="border rounded px-2 py-1 w-full" placeholder="Titolo" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
      <div className="grid grid-cols-2 gap-2"><input className="border rounded px-2 py-1 w-full" placeholder="Brand" value={form.brand} onChange={e=>setForm({...form, brand:e.target.value})}/><input className="border rounded px-2 py-1 w-full" placeholder="Categoria" value={form.category} onChange={e=>setForm({...form, category:e.target.value})}/></div>
      <div className="grid grid-cols-3 gap-2"><input className="border rounded px-2 py-1 w-full" placeholder="Taglia" value={form.size} onChange={e=>setForm({...form, size:e.target.value})}/><input className="border rounded px-2 py-1 w-full" type="number" step="0.01" placeholder="Prezzo" value={form.price} onChange={e=>setForm({...form, price:parseFloat(e.target.value||'0')})}/><input className="border rounded px-2 py-1 w-full" type="number" step="0.01" placeholder="Costo" value={form.cost} onChange={e=>setForm({...form, cost:parseFloat(e.target.value||'0')})}/></div>
      <div className="grid grid-cols-2 gap-2"><input className="border rounded px-2 py-1 w-full" type="number" placeholder="Quantità" value={form.quantity} onChange={e=>setForm({...form, quantity:parseInt(e.target.value||'0')})}/><input className="border rounded px-2 py-1 w-full" placeholder="Descrizione breve" value={form.description} onChange={e=>setForm({...form, description:e.target.value})}/></div>
      <div className="flex items-center gap-2"><input type="file" onChange={onFile}/>{form.image_url && <img src={form.image_url} className="w-12 h-12 object-cover rounded"/>}</div>
      <button className="px-3 py-2 rounded bg-black text-white">Salva</button></form></div>) }