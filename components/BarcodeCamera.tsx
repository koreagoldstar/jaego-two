'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType, type Result } from '@zxing/library'
import { Camera, ImageIcon, Loader2, ScanLine } from 'lucide-react'
import { normalizeBarcodePayload } from '@/lib/items/barcodePayload'

const UPSCALE_CANVAS_MAX = 2560
const UPSCALE_MIN = 1.5
const UPSCALE_MAX = 2.5
const DECODE_INTERVAL_MS = 90

function computeDecodeScale(w: number, h: number): number {
  const m = Math.max(w, h)
  if (m <= 0) return 1.5
  let scale = Math.min(UPSCALE_MAX, UPSCALE_CANVAS_MAX / m)
  scale = Math.max(scale, UPSCALE_MIN)
  const tw = w * scale
  const th = h * scale
  if (tw > UPSCALE_CANVAS_MAX || th > UPSCALE_CANVAS_MAX) {
    scale = UPSCALE_CANVAS_MAX / m
  }
  return scale
}

function buildScannerHints(): Map<DecodeHintType, unknown> {
  const hints = new Map<DecodeHintType, unknown>()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.AZTEC,
    BarcodeFormat.PDF_417,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.CODABAR,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.ITF,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ])
  hints.set(DecodeHintType.TRY_HARDER, true)
  return hints
}

async function decodeWithCanvasFallback(
  reader: BrowserMultiFormatReader,
  img: HTMLImageElement,
): Promise<string> {
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) throw new Error('no dimensions')

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no canvas')

  const tryDecode = () => {
    const r = reader.decodeFromCanvas(canvas)
    return normalizeBarcodePayload(r.getText())
  }

  const scale = computeDecodeScale(w, h)
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  try {
    return tryDecode()
  } catch {
    /* center crop */
  }

  const cx = w * 0.225
  const cy = h * 0.225
  const cw = w * 0.55
  const ch = h * 0.55
  canvas.width = Math.round(cw * scale)
  canvas.height = Math.round(ch * scale)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, cx, cy, cw, ch, 0, 0, canvas.width, canvas.height)
  return tryDecode()
}

async function decodeImageFile(
  file: File,
  reader: BrowserMultiFormatReader,
): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    try {
      const result = await reader.decodeFromImageUrl(url)
      const text = normalizeBarcodePayload(result.getText())
      if (text) return text
    } catch {
      /* canvas fallback */
    }

    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('image load failed'))
      img.src = url
    })

    return await decodeWithCanvasFallback(reader, img)
  } finally {
    URL.revokeObjectURL(url)
  }
}

type ScanMode = 'live' | 'photo'

type Props = {
  onDecode: (text: string) => void | Promise<void>
  initialStatus?: string
  className?: string
  videoClassName?: string
}

export function BarcodeCamera({
  onDecode,
  initialStatus = '실시간으로 비추거나 사진을 찍어 주세요.',
  className = '',
  videoClassName = 'w-full max-h-[min(42vh,320px)] min-h-[200px] object-contain bg-black',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const lastAt = useRef(0)
  const lastText = useRef('')
  const onDecodeRef = useRef(onDecode)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const [scanMode, setScanMode] = useState<ScanMode>('live')
  const [status, setStatus] = useState(initialStatus)
  const [busy, setBusy] = useState(false)

  onDecodeRef.current = onDecode

  const getReader = useCallback(() => {
    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader(buildScannerHints(), {
        delayBetweenScanAttempts: 80,
        delayBetweenScanSuccess: 350,
        tryPlayVideoTimeout: 12_000,
      })
    }
    return readerRef.current
  }, [])

  const emitDecoded = useCallback(async (raw: string) => {
    const text = normalizeBarcodePayload(raw)
    if (!text) return
    const now = Date.now()
    if (text === lastText.current && now - lastAt.current < 2500) return
    lastText.current = text
    lastAt.current = now
    await Promise.resolve(onDecodeRef.current(text)).catch(() => {})
  }, [])

  useEffect(() => {
    if (scanMode !== 'live') return

    const reader = new BrowserMultiFormatReader(buildScannerHints(), {
      delayBetweenScanAttempts: 80,
      delayBetweenScanSuccess: 350,
      tryPlayVideoTimeout: 12_000,
    })
    let cancelled = false
    let attachedVideo: HTMLVideoElement | null = null
    let stream: MediaStream | null = null
    let decodeTimer: ReturnType<typeof setInterval> | undefined
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const pickBackDeviceId = async () => {
      let envDeviceId: string | undefined
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        const track = s.getVideoTracks()[0]
        envDeviceId = track?.getSettings().deviceId
        s.getTracks().forEach(t => t.stop())
      } catch {
        /* fallback */
      }

      if (envDeviceId) return envDeviceId

      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      const scored = devices
        .map(d => {
          const label = d.label.toLowerCase()
          let score = 0
          if (/back|rear|environment|후면|뒤/i.test(label)) score += 100
          if (/front|user|facetime|전면|앞/i.test(label)) score -= 100
          return { id: d.deviceId, score }
        })
        .sort((a, b) => b.score - a.score)

      return scored[0]?.id
    }

    const tryPlayVideoWithTimeout = (videoEl: HTMLVideoElement) =>
      Promise.race([
        BrowserCodeReader.tryPlayVideo(videoEl),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('tryPlayVideo timeout')), 12_000),
        ),
      ])

    const startDecode = async () => {
      const videoEl = videoRef.current
      if (!videoEl || cancelled || !ctx) return
      attachedVideo = videoEl

      const onResult = (result: Result | undefined) => {
        if (cancelled || !result) return
        const text = normalizeBarcodePayload(result.getText())
        if (!text) return
        void emitDecoded(text)
      }

      const constraintAttempts: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920, min: 720 },
            height: { ideal: 1080, min: 540 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        },
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
          },
          audio: false,
        },
        {
          video: {
            facingMode: 'environment',
            width: { min: 640 },
            height: { min: 480 },
          },
          audio: false,
        },
        { video: { facingMode: 'environment' }, audio: false },
      ]

      const startCanvasLoop = () => {
        let frameToggle = false
        decodeTimer = setInterval(() => {
          if (cancelled || !stream) return
          const vw = videoEl.videoWidth
          const vh = videoEl.videoHeight
          if (!vw || !vh) return

          frameToggle = !frameToggle
          const scale = computeDecodeScale(vw, vh)
          canvas.width = Math.round(vw * scale)
          canvas.height = Math.round(vh * scale)
          ctx.imageSmoothingEnabled = false

          if (frameToggle) {
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
          } else {
            const cx = vw * 0.225
            const cy = vh * 0.225
            const cw = vw * 0.55
            const ch = vh * 0.55
            ctx.drawImage(videoEl, cx, cy, cw, ch, 0, 0, canvas.width, canvas.height)
          }

          try {
            const result = reader.decodeFromCanvas(canvas)
            onResult(result)
          } catch {
            /* NotFound */
          }
        }, DECODE_INTERVAL_MS)
      }

      for (const constraints of constraintAttempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints)
          break
        } catch {
          stream = null
        }
      }

      if (!stream) {
        try {
          const back = await pickBackDeviceId()
          if (!back) throw new Error('no device')
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: back },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          })
        } catch {
          setStatus('카메라를 사용할 수 없습니다. 아래에서 「사진으로 읽기」를 쓰세요.')
          return
        }
      }

      BrowserCodeReader.addVideoSource(videoEl, stream)
      try {
        await tryPlayVideoWithTimeout(videoEl)
      } catch {
        setStatus('영상을 시작하지 못했습니다. 「사진으로 읽기」를 이용해 보세요.')
        stream.getTracks().forEach(t => t.stop())
        stream = null
        BrowserCodeReader.cleanVideoSource(videoEl)
        return
      }

      setStatus('코드에 맞추면 바로 인식합니다 · 작은 라벨은 가까이')
      startCanvasLoop()
    }

    setStatus('카메라 시작 중…')
    void startDecode()

    return () => {
      cancelled = true
      if (decodeTimer !== undefined) clearInterval(decodeTimer)
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
        stream = null
      }
      if (attachedVideo) BrowserCodeReader.cleanVideoSource(attachedVideo)
    }
  }, [scanMode, emitDecoded])

  const handleFile = useCallback(
    async (file: File | undefined) => {
      const okType =
        file &&
        (file.type.startsWith('image/') ||
          file.type === '' ||
          /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name))
      if (!file || !okType) {
        setStatus('이미지 파일을 선택해 주세요.')
        return
      }

      setBusy(true)
      setStatus('인식 중…')
      try {
        const reader = getReader()
        const text = (await decodeImageFile(file, reader)).trim()
        if (!text) {
          setStatus('코드를 찾지 못했습니다. 더 선명하게 찍어 보세요.')
          return
        }
        const now = Date.now()
        if (text === lastText.current && now - lastAt.current < 2500) {
          setStatus('같은 코드가 방금 읽혔습니다.')
          return
        }
        lastText.current = text
        lastAt.current = now
        setStatus('처리 중…')
        await Promise.resolve(onDecodeRef.current(text)).catch(() => {})
        setStatus('다음 코드를 찍거나 선택하세요.')
      } catch {
        setStatus('인식하지 못했습니다. 밝은 곳에서 초점을 맞춰 보세요.')
      } finally {
        setBusy(false)
        if (cameraInputRef.current) cameraInputRef.current.value = ''
        if (galleryInputRef.current) galleryInputRef.current.value = ''
      }
    },
    [getReader],
  )

  useEffect(() => {
    if (scanMode === 'photo') {
      setStatus('촬영 후 저장하면 바로 읽습니다.')
    }
  }, [scanMode])

  return (
    <div className={`rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-lg ${className}`}>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={e => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="sr-only"
        tabIndex={-1}
        onChange={e => void handleFile(e.target.files?.[0])}
      />

      <div className="flex border-b border-slate-800 bg-slate-950">
        <button
          type="button"
          onClick={() => setScanMode('live')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            scanMode === 'live'
              ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ScanLine className="w-4 h-4" />
          실시간 스캔
        </button>
        <button
          type="button"
          onClick={() => setScanMode('photo')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            scanMode === 'photo'
              ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="w-4 h-4" />
          사진으로 읽기
        </button>
      </div>

      {scanMode === 'live' ? (
        <video ref={videoRef} className={videoClassName} playsInline muted autoPlay />
      ) : (
        <div className="w-full max-h-[min(42vh,320px)] min-h-[200px] flex flex-col items-center justify-center bg-slate-950 text-slate-300 px-4 py-6">
          <p className="text-sm text-center mb-4 max-w-sm leading-relaxed">
            휴대폰 <strong className="text-slate-100">기본 카메라 앱</strong>으로 찍은 사진을 바로 분석합니다. 촬영 후
            「사진 사용」만 누르면 됩니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <button
              type="button"
              disabled={busy}
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-3 px-4 transition-colors"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5 shrink-0" />}
              카메라로 촬영
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => galleryInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-medium py-3 px-4 transition-colors"
            >
              <ImageIcon className="w-5 h-5 shrink-0" />
              사진에서 선택
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-900 text-slate-200 text-sm px-4 py-3 flex items-center gap-2 min-h-[3rem]">
        {(busy || (scanMode === 'live' && status.includes('시작'))) && (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        )}
        <span className="break-all">{status}</span>
      </div>
    </div>
  )
}
