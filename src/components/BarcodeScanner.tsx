import { useEffect, useRef, useState } from 'react'
import { IconX } from '@tabler/icons-react'

type Props = { onDetect: (code: string) => void; onClose: () => void }

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type ZReader = { decodeFromVideoDevice: (id: string | null, v: HTMLVideoElement, cb: (r: { getText: () => string } | null) => void) => Promise<unknown> | void; reset: () => void }
type ZLib = { BrowserMultiFormatReader: new (hints?: Map<unknown, unknown>) => ZReader; DecodeHintType: { POSSIBLE_FORMATS: unknown }; BarcodeFormat: Record<string, unknown> }
type W = Window & { BarcodeDetector?: new (o: { formats: string[] }) => Detector; ZXing?: ZLib }

// Browsers with a built-in barcode reader (Chrome, Edge, Android) use it. iPhone Safari has none, so we load a small open-source reader (ZXing) once.
const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'
function loadZxing(): Promise<ZLib> {
  const w = window as W
  if (w.ZXing) return Promise.resolve(w.ZXing)
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = ZXING_URL
    s.onload = () => (w.ZXing ? resolve(w.ZXing) : reject(new Error('no ZXing')))
    s.onerror = () => reject(new Error('load failed'))
    document.head.appendChild(s)
  })
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

/** Full-screen camera that reads one barcode and hands it back. */
export default function BarcodeScanner({ onDetect, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stopped = false
    let timer = 0
    let stream: MediaStream | null = null
    let reader: ZReader | null = null
    const video = videoRef.current
    const done = (code: string) => {
      if (stopped) return
      const digits = code.replace(/\D/g, '')
      if (digits.length < 8) return
      stopped = true
      navigator.vibrate?.(30)
      onDetect(digits)
    }
    async function start() {
      if (!video) return
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot use the camera. Type the barcode instead.')
        return
      }
      try {
        const Det = (window as W).BarcodeDetector
        if (Det) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
          if (stopped) return
          video.srcObject = stream
          video.setAttribute('playsinline', 'true')
          await video.play()
          const det = new Det({ formats: FORMATS })
          const loop = async () => {
            if (stopped) return
            try {
              const found = await det.detect(video)
              if (found.length) return done(found[0].rawValue)
            } catch {
              /* keep trying */
            }
            timer = window.setTimeout(loop, 180)
          }
          void loop()
        } else {
          const Z = await loadZxing()
          if (stopped) return
          const hints = new Map<unknown, unknown>()
          hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_128])
          reader = new Z.BrowserMultiFormatReader(hints)
          video.setAttribute('playsinline', 'true')
          await reader.decodeFromVideoDevice(null, video, (r) => {
            if (r) done(r.getText())
          })
        }
      } catch (e) {
        const name = (e as { name?: string })?.name
        setError(name === 'NotAllowedError' ? 'Camera access was blocked. Allow the camera for Muna in your settings, or type the barcode instead.' : 'The scanner could not start. Type the barcode instead.')
      }
    }
    void start()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      try {
        reader?.reset()
      } catch {
        /* fine */
      }
      stream?.getTracks().forEach((t) => t.stop())
      if (video) video.srcObject = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="scan-backdrop" role="dialog" aria-modal="true" aria-label="Scan a barcode">
      <video ref={videoRef} className="scan-video" muted playsInline />
      <div className="scan-frame" aria-hidden="true" />
      <button className="scan-close" onClick={onClose} aria-label="Close scanner">
        <IconX size={24} />
      </button>
      <p className="scan-hint">{error || 'Point the camera at the barcode and hold still'}</p>
    </div>
  )
}
