import React, { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { api } from '../lib/api'

type Product = { id:number; name:string; sku:string; price:number; quantity:number; sold_count:number }

export const SellPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [barcode, setBarcode] = useState('')
  const [product, setProduct] = useState<Product | null>(null)

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
          if (result) setBarcode(result.getText())
        })
      } catch {}
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!barcode) return
    api.get('/products', { params: { q: barcode }}).then(({data}) => {
      const p = data.find((x:any)=> x.sku===barcode) || data[0]
      setProduct(p || null)
    })
  }, [barcode])

  const sell = async () => {
    if (!product) return
    await api.post(`/products/${product.id}/sell`, null, { params: { qty: 1 } })
    alert('Venduto!')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl shadow p-3">
        <h3 className="font-semibold mb-2">Scanner</h3>
        <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video" />
        <div className="mt-2 text-sm">Barcode: <b>{barcode}</b></div>
      </div>

      <div className="bg-white rounded-xl shadow p-3">
        <h3 className="font-semibold">Dettagli</h3>
        {product ? (
          <div>
            <div className="font-semibold">{product.name}</div>
            <div>SKU: {product.sku}</div>
            <div className="text-lg font-bold my-2">€ {product.price.toFixed(2)}</div>
            <div>Stock: {product.quantity} • Venduti: {product.sold_count}</div>
            <button onClick={sell} className="mt-3 px-3 py-2 rounded bg-black text-white">Vendi 1</button>
          </div>
        ) : <div className="text-gray-500">Scansiona un prodotto…</div>}
      </div>
    </div>
  )
}