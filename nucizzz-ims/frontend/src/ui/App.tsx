import React, { useEffect, useState } from 'react'
import { InventoryPage } from './InventoryPage'
import { ReceivePage } from './ReceivePage'
import { SellPage } from './SellPage'
import { AnalyticsPage } from './AnalyticsPage'
import { api, setApiKey } from '../lib/api'

export const App: React.FC = () => {
  const [tab, setTab] = useState<'inventory'|'receive'|'sell'|'analytics'>('inventory')
  const [apiKey, setKey] = useState<string>('')

  useEffect(() => {
    const k = localStorage.getItem('ims_api_key') || ''
    setKey(k)
    if (k) setApiKey(k)
  }, [])

  const saveKey = () => {
    localStorage.setItem('ims_api_key', apiKey)
    setApiKey(apiKey)
    alert('API Key salvata.')
  }

  return (
    <div className="max-w-7xl mx-auto p-4">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Nucizzz IMS</h1>
        <div className="flex items-center gap-2">
          <input className="border rounded px-2 py-1" type="password" placeholder="API Key" value={apiKey} onChange={e=>setKey(e.target.value)} />
          <button className="px-3 py-1 rounded bg-black text-white" onClick={saveKey}>Salva</button>
        </div>
      </header>

      <nav className="flex gap-2 mb-6">
        {(['inventory','receive','sell','analytics'] as const).map(t => (
          <button key={t} onClick={()=>setTab(t)}
            className={'px-3 py-2 rounded border ' + (t===tab?'bg-black text-white':'bg-white hover:bg-gray-100')}>
            {t==='inventory'?'Prodotti':t==='receive'?'Aggiungi':'sell'===t?'Vendita':'Analisi'}
          </button>
        ))}
      </nav>

      {tab==='inventory' && <InventoryPage/>}
      {tab==='receive' && <ReceivePage/>}
      {tab==='sell' && <SellPage/>}
      {tab==='analytics' && <AnalyticsPage/>}

      <footer className="mt-8 text-sm text-gray-500">© Nucizzz IMS</footer>
    </div>
  )
}