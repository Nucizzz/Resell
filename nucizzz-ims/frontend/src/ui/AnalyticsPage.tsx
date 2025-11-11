import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

export const AnalyticsPage: React.FC = () => {
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    api.get('/analytics/summary').then(({data})=> setSummary(data))
  }, [])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card title="Prodotti totali" value={summary?.total_products ?? '—'} />
        <Card title="Quantità totale" value={summary?.total_quantity ?? '—'} />
        <Card title="Venduti" value={summary?.sold_total ?? '—'} />
        <Card title="Ricavi stimati" value={summary ? '€ ' + summary.estimated_revenue.toFixed(2) : '—'} />
      </div>

      <div className="lg:col-span-3 bg-white rounded-xl shadow p-3">
        <div className="font-semibold mb-2">Esempio (ricavi vs vendite)</div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={[
            { name:'Settimana 1', vendite: summary?.sold_total || 0, ricavi: summary?.estimated_revenue || 0 }
          ]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="vendite" />
            <Line type="monotone" dataKey="ricavi" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const Card: React.FC<{title:string, value:any}> = ({title, value}) => (
  <div className="bg-white rounded-xl shadow p-4">
    <div className="text-sm text-gray-600">{title}</div>
    <div className="text-2xl font-bold">{value}</div>
  </div>
)