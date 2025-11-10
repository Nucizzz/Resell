import React, { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'

type Props = { onDetected: (code: string) => void }

export default function Scanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader()
    let stream: MediaStream | null = null
    let active = true

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        while (active) {
          const result = await codeReader.decodeOnceFromVideoElement(videoRef.current!)
          if (result) {
            onDetected(result.getText())
          }
        }
      } catch (e: any) {
        setError(e?.message || 'Errore fotocamera')
      }
    }
    start()

    return () => {
      active = false
      if (stream) stream.getTracks().forEach(t => t.stop())
      codeReader.reset()
    }
  }, [onDetected])

  return (
    <div className="card">
      <video ref={videoRef} className="w-full rounded-xl" />
      {error && <p className="text-red-600 mt-2">{error}</p>}
    </div>
  )
}
