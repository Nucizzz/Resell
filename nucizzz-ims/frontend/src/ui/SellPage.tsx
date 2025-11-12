import React, { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { api, setApiKey } from '../lib/api'
type Product = { id:number; name:string; sku:string; price:number; quantity:number; sold_count:number }
export const SellPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [barcode,setBarcode]=useState(''); const [err,setErr]=useState<string|null>(null)
  const [product,setProduct]=useState<Product|null>(null)
  useEffect(()=>{ const k=localStorage.getItem('ims_api_key')||''; if(k) setApiKey(k) },[])
  useEffect(()=>{ const r=new BrowserMultiFormatReader(); let active=true; (async()=>{ try{
    if(location.protocol!=='https:' && location.hostname!=='localhost'){ setErr('HTTPS richiesto per la fotocamera'); return }
    const dev=await BrowserMultiFormatReader.listVideoInputDevices(); const id=dev.find(d=>/back|rear|environment/i.test(d.label))?.deviceId||dev[0]?.deviceId
    if(!id){ setErr('Nessuna fotocamera disponibile o permesso negato'); return }
    await r.decodeFromVideoDevice(id, videoRef.current!, (res,e)=>{ if(!active) return; if(res) setBarcode(res.getText()) })
  }catch(e:any){ setErr(e?.message||'Errore fotocamera') } })(); return ()=>{ active=false } },[])
  useEffect(()=>{ if(!barcode) return; api.get('/products',{params:{q:barcode}}).then(({data})=>{ const p=data.find((x:any)=>x.sku===barcode)||data[0]; setProduct(p||null) }) },[barcode])
  const sell=async()=>{ if(!product) return; await api.post(`/products/${product.id}/sell`,null,{params:{qty:1}}); alert('Venduto!') }
  return (<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div className="bg-white rounded-xl shadow p-3"><h3 className="font-semibold mb-2">Scanner</h3><video ref={videoRef} className="w-full rounded-lg bg-black aspect-video"/>{err?<div className="mt-2 text-red-600 text-sm">{err}</div>:<div className="mt-2 text-sm">Barcode: <b>{barcode}</b></div>}</div>
    <div className="bg-white rounded-xl shadow p-3"><h3 className="font-semibold">Dettagli</h3>{product? <div><div className="font-semibold">{product.name}</div><div>SKU: {product.sku}</div><div className="text-lg font-bold my-2">€ {product.price.toFixed(2)}</div><div>Stock: {product.quantity} • Venduti: {product.sold_count}</div><button onClick={sell} className="mt-3 px-3 py-2 rounded bg-black text-white">Vendi 1</button></div> : <div className="text-gray-500">Scansiona un prodotto…</div>}</div></div>) }