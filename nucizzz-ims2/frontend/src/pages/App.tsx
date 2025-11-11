import React, { useEffect, useState } from 'react'
import { api } from '../api'
import Scanner from '../components/Scanner'

type Product={id:number; barcode:string; title:string; description?:string|null; brand?:string|null; model?:string|null; colorway?:string|null; category?:string|null; tags?:string|null; size?:string|null; condition?:string|null; sku?:string|null; cost_eur:number; price_eur:number; weight_grams?:number|null; package_required:boolean; image_url?:string|null; quantity:number; available:boolean; location_id?:number|null}
type Location={id:number; name:string}

function Filters({onChange}:{onChange:(f:any)=>void}){
  const [q,setQ]=useState(''); const [brand,setBrand]=useState(''); const [category,setCategory]=useState(''); const [available,setAvailable]=useState(''); const [locationId,setLocationId]=useState(''); const [locations,setLocations]=useState<Location[]>([])
  useEffect(()=>{ api.get('/locations').then(r=>setLocations(r.data)) },[])
  return (<div className="card grid md:grid-cols-6 gap-2">
    <input className="input md:col-span-2" placeholder="Cerca testo/Barcode" value={q} onChange={e=>setQ(e.target.value)}/>
    <input className="input" placeholder="Brand" value={brand} onChange={e=>setBrand(e.target.value)}/>
    <input className="input" placeholder="Categoria" value={category} onChange={e=>setCategory(e.target.value)}/>
    <select className="select" value={available} onChange={e=>setAvailable(e.target.value)}><option value="">Disponibilità</option><option value="true">Disponibili</option><option value="false">Venduti</option></select>
    <select className="select" value={locationId} onChange={e=>setLocationId(e.target.value)}><option value="">Tutte le sedi</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
    <button className="btn" onClick={()=>onChange({q,brand,category,available,locationId})}>Filtra</button>
  </div>)
}

function ProductRow({p,onRefresh}:{p:Product,onRefresh:()=>void}){
  const [open,setOpen]=useState(false); const [qty,setQty]=useState(1); const [toLoc,setToLoc]=useState(''); const [locs,setLocs]=useState<Location[]>([])
  useEffect(()=>{ api.get('/locations').then(r=>setLocs(r.data)) },[])
  async function sell(){ await api.post('/products/sell',{barcode:p.barcode,quantity:qty}); onRefresh(); setOpen(false) }
  async function del(){ await api.delete(`/products/${p.id}`); onRefresh(); setOpen(false) }
  async function transfer(){ if(!toLoc) return; await api.post('/products/transfer',{barcode:p.barcode,to_location_id:Number(toLoc),quantity:1}); onRefresh() }
  return (<div className="card">
    <div className="flex gap-3 items-center">
      {p.image_url && <img src={p.image_url} className="w-16 h-16 object-cover rounded-lg"/>}
      <div className="flex-1"><div className="font-semibold">{p.title} <span className="badge">{p.brand||''}</span> <span className="badge">{p.barcode}</span></div><div className="text-sm text-gray-600">{p.description}</div><div className="text-sm">€ {p.price_eur.toFixed(2)} — Q.ty {p.quantity} — {p.available?'Disponibile':'Venduto'}</div></div>
      <button className="btn" onClick={()=>setOpen(o=>!o)}>{open?'Chiudi':'Azioni'}</button>
    </div>
    {open && (<div className="mt-3 grid md:grid-cols-4 gap-2">
      <div className="card space-y-2"><div className="font-semibold">Vendi/Scarica</div><input className="input" type="number" min={1} value={qty} onChange={e=>setQty(parseInt(e.target.value||'1'))}/><button className="btn" onClick={sell}>Vendi</button></div>
      <div className="card space-y-2"><div className="font-semibold">Trasferisci</div><select className="select" value={toLoc} onChange={e=>setToLoc(e.target.value)}><option value="">Seleziona sede</option>{locs.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select><button className="btn" onClick={transfer}>Trasferisci</button></div>
      <div className="card space-y-2"><div className="font-semibold">Elimina</div><button className="btn bg-red-600" onClick={del}>Elimina</button></div>
    </div>)}
  </div>)
}

function Receive(){
  const [form,setForm]=useState<any>({ barcode:'', title:'', brand:'', model:'', colorway:'', category:'sneakers', size:'', condition:'new', sku:'', price_eur:0, cost_eur:0, quantity:1, description:'', package_required:false, image_url:'' })
  const [img,setImg]=useState<File|null>(null); const [msg,setMsg]=useState<string|null>(null); const [locs,setLocs]=useState<Location[]>([])
  useEffect(()=>{ api.get('/locations').then(r=>setLocs(r.data)) },[])

  async function lookup(){
    if(!form.barcode) return
    const r = await api.get(`/lookup/${form.barcode}`)
    const d = r.data||{}
    setForm((f:any)=>({...f,
      title: d.title||f.title, brand: d.brand||f.brand, model: d.model||f.model,
      colorway: d.colorway||f.colorway, category: d.category||f.category,
      description: d.description||f.description, image_url: d.image_url||f.image_url, sku: d.sku||f.sku
    }))
  }

  async function uploadIfAny(){ if(!img) return null; const fd=new FormData(); fd.append('file',img); const r=await api.post('/upload',fd,{headers:{'Content-Type':'multipart/form-data'}}); return r.data.url as string }
  async function submit(){ try{ const image_url=await uploadIfAny() || form.image_url || null; const body={...form, image_url, cost_eur:Number(form.cost_eur||0), price_eur:Number(form.price_eur||0), quantity:Number(form.quantity||1), location_id: form.location_id? Number(form.location_id): null}; const r=await api.post('/products/receive', body); setMsg('Creato #'+r.data.id); }catch(e:any){ setMsg(e?.response?.data?.detail||'Errore') } }

  return (<div className="space-y-3">
    <Scanner onDetected={(code)=> setForm((f:any)=>({...f, barcode:code})) }/>
    <div className="card grid md:grid-cols-2 gap-2">
      <div className="md:col-span-2 flex gap-2">
        <input className="input" placeholder="Barcode" value={form.barcode} onChange={e=>setForm({...form, barcode:e.target.value})}/>
        <button className="btn" onClick={lookup}>Cerca info</button>
      </div>
      <input className="input" placeholder="Titolo" value={form.title} onChange={e=>setForm({...form, title:e.target.value})}/>
      <input className="input" placeholder="Brand" value={form.brand} onChange={e=>setForm({...form, brand:e.target.value})}/>
      <input className="input" placeholder="Modello" value={form.model} onChange={e=>setForm({...form, model:e.target.value})}/>
      <input className="input" placeholder="Colorway" value={form.colorway} onChange={e=>setForm({...form, colorway:e.target.value})}/>
      <input className="input" placeholder="Categoria" value={form.category} onChange={e=>setForm({...form, category:e.target.value})}/>
      <input className="input" placeholder="Taglia (es. EU 43)" value={form.size} onChange={e=>setForm({...form, size:e.target.value})}/>
      <input className="input" placeholder="Condizione (new/used)" value={form.condition} onChange={e=>setForm({...form, condition:e.target.value})}/>
      <input className="input" placeholder="SKU" value={form.sku} onChange={e=>setForm({...form, sku:e.target.value})}/>
      <input className="input" placeholder="Prezzo EUR" type="number" step="0.01" value={form.price_eur} onChange={e=>setForm({...form, price_eur:e.target.value})}/>
      <input className="input" placeholder="Costo EUR" type="number" step="0.01" value={form.cost_eur} onChange={e=>setForm({...form, cost_eur:e.target.value})}/>
      <input className="input" placeholder="Peso (g)" type="number" value={form.weight_grams||''} onChange={e=>setForm({...form, weight_grams:Number(e.target.value||0)})}/>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.package_required} onChange={e=>setForm({...form, package_required:e.target.checked})}/>Pacco richiesto</label>
      <select className="select" value={form.location_id||''} onChange={e=>setForm({...form, location_id:e.target.value})}>
        <option value="">Sede (opz)</option>{locs.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <input className="input" placeholder="Quantità" type="number" min={1} value={form.quantity} onChange={e=>setForm({...form, quantity:e.target.value})}/>
      <input className="input" placeholder="URL immagine (opz)" value={form.image_url||''} onChange={e=>setForm({...form, image_url:e.target.value})}/>
      <input className="input" type="file" accept="image/*" onChange={e=>setImg(e.target.files?.[0]||null)}/>
      <textarea className="input md:col-span-2" placeholder="Descrizione" value={form.description} onChange={e=>setForm({...form, description:e.target.value})}/>
    </div>
    <button className="btn" onClick={submit}>Salva</button>
    {msg && <p className="text-sm">{msg}</p>}
  </div>)
}

function Locations(){
  const [name,setName]=useState(''); const [items,setItems]=useState<Location[]>([])
  async function load(){ const r=await api.get('/locations'); setItems(r.data) }
  useEffect(()=>{ load() },[])
  async function add(){ if(!name) return; await api.post('/locations',{name}); setName(''); load() }
  return (<div className="space-y-3">
    <div className="card flex gap-2">
      <input className="input" placeholder="Nome sede (es. Negozio)" value={name} onChange={e=>setName(e.target.value)}/>
      <button className="btn" onClick={add}>Aggiungi</button>
    </div>
    <div className="grid gap-2">{items.map(i=><div key={i.id} className="card">{i.name}</div>)}</div>
  </div>)
}

export default function App(){
  const [tab,setTab]=useState<'list'|'receive'|'locations'>('list')
  const [filters,setFilters]=useState<any>({})
  const [rows,setRows]=useState<Product[]>([])
  async function load(){ const params:any={}; if(filters.q) params.q=filters.q; if(filters.brand) params.brand=filters.brand; if(filters.category) params.category=filters.category; if(filters.available!=='') params.available=filters.available; if(filters.locationId) params.location_id=filters.locationId; const r=await api.get('/products',{params}); setRows(r.data) }
  useEffect(()=>{ if(tab==='list') load() },[tab,filters])
  return (<div className="max-w-5xl mx-auto p-4 space-y-4">
    <h1 className="text-2xl font-bold">Nucizzz IMS — Fashion</h1>
    <div className="flex gap-2">
      <button className={`btn ${tab==='list'?'':'opacity-70'}`} onClick={()=>setTab('list')}>Prodotti</button>
      <button className={`btn ${tab==='receive'?'':'opacity-70'}`} onClick={()=>setTab('receive')}>Ricezione</button>
      <button className={`btn ${tab==='locations'?'':'opacity-70'}`} onClick={()=>setTab('locations')}>Sedi</button>
    </div>
    {tab==='list' && (<><Filters onChange={setFilters}/><div className="grid gap-2">{rows.map(p=><ProductRow key={p.id} p={p} onRefresh={load}/>)}</div></>)}
    {tab==='receive' && <Receive/>}
    {tab==='locations' && <Locations/>}
  </div>)
}
