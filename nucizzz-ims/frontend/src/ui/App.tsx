import React, { useEffect, useState } from 'react'
import { InventoryPage } from './InventoryPage'
import { ReceivePage } from './ReceivePage'
import { SellPage } from './SellPage'
import { AnalyticsPage } from './AnalyticsPage'
export const App: React.FC = () => {
  const [tab, setTab] = useState<'receive'|'sell'|'inventory'|'analytics'>('receive')
  const [apiKey, setKey] = useState('')
  useEffect(()=>{ setKey(localStorage.getItem('ims_api_key')||'') },[])
  const saveKey=()=>{ localStorage.setItem('ims_api_key', apiKey); location.reload() }
  return (<div className="max-w-7xl mx-auto p-4">
    <header className="flex items-center justify-between mb-4"><h1 className="text-2xl font-bold">Nucizzz IMS</h1>
      <div className="flex items-center gap-2"><input className="border rounded px-2 py-1" type="password" placeholder="API Key" value={apiKey} onChange={e=>setKey(e.target.value)}/>
      <button className="px-3 py-1 rounded bg-black text-white" onClick={saveKey}>Salva</button></div></header>
    <nav className="flex gap-2 mb-6 flex-wrap">{[['receive','Ricezione'],['sell','Vendita'],['inventory','Prodotti'],['analytics','Analisi']].map(([t,l])=>(
      <button key={t} onClick={()=>setTab(t as any)} className={'px-3 py-2 rounded border '+(tab===t?'bg-black text-white':'bg-white hover:bg-gray-100')}>{l}</button>))}</nav>
    {tab==='inventory'&&<InventoryPage/>}{tab==='receive'&&<ReceivePage/>}{tab==='sell'&&<SellPage/>}{tab==='analytics'&&<AnalyticsPage/>}
  </div>) }