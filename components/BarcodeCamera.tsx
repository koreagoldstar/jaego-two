'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType, type Result } from '@zxing/library'
import { Camera, ImageIcon, Loader2, ScanLine } from 'lucide-react'
import { normalizeBarcodePayload } from '@/lib/items/barcodePayload'

const UPSCALE_CANVAS_MAX = 2560
const UPSCALE_MIN = 1.5
const UPSCALE_MAX = 2.5
/** 사진 파일: 가느다란 막대 인식을 위해 조금 더 키움 */
const PHOTO_UPSCALE_MAX = 3
const DECODE_INTERVAL_MS = 72

function computeDecodeScale(w: number, h: number, maxScale = UPSCALE_MAX): number {
  const m = Math.max(w, h)
  if (m <= 0) return 1.5
  let scale = Math.min(maxScale, UPSCALE_CANVAS_MAX / m)
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

function drawBinarized(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLVideoElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  threshold: number,
) {
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
  const id = ctx.getImageData(0, 0, dw, dh)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const v = lum >= threshold ? 255 : 0
    d[i] = v
    d[i + 1] = v
    d[i + 2] = v
  }
  ctx.putImageData(id, 0, 0)
}

function tryDecodeCanvas(reader: BrowserMultiFormatReader, canvas: HTMLCanvasElement): string | null {
  try {
    return normalizeBarcodePayload(reader.decodeFromCanvas(canvas).getText())
  } catch {
    return null
  }
}

/** 사진 한 장: 컬러·이진화·스케일·중앙크롭 조합으로 1D까지 집요하게 */
function decodeStillImageFromBitmap(reader: BrowserMultiFormatReader, img: HTMLImageElement): string {
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) throw new Error('no dimensions')

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no canvas')

  const runRegion = (ix: number, iy: number, iw: number, ih: number, scales: number[], modes: Array<'color' | number>) => {
    for (const scale of scales) {
      const dw = Math.round(iw * scale)
      const dh = Math.round(ih * scale)
      if (dw < 32 || dh < 32) continue
      canvas.width = dw
      canvas.height = dh
      for (const mode of modes) {
        if (mode === 'color') {
          ctx.imageSmoothingEnabled = false
          ctx.drawImage(img, ix, iy, iw, ih, 0, 0, dw, dh)
        } else {
          ctx.imageSmoothingEnabled = false
          drawBinarized(ctx, img, ix, iy, iw, ih, 0, 0, dw, dh, mode)
        }
        const t = tryDecodeCanvas(reader, canvas)
        if (t) return t
      }
    }
    return ''
  }

  const base = computeDecodeScale(w, h, PHOTO_UPSCALE_MAX)
  const maxS = UPSCALE_CANVAS_MAX / Math.max(w, h)
  const scales = Array.from(
    new Set([base, Math.min(base * 1.12, maxS), Math.min(base * 1.28, maxS)].filter(s => s >= UPSCALE_MIN)),
  ).sort((a, b) => b - a)
  const thresholds = [112, 128, 144, 96, 160]

  let t = runRegion(0, 0, w, h, scales, ['color', ...thresholds])
  if (t) return t

  const cx = w * 0.2
  const cy = h * 0.2
  const cw = w * 0.6
  const ch = h * 0.6
  t = runRegion(cx, cy, cw, ch, scales, ['color', 128, 112, 144])
  if (t) return t

  throw new Error('decode')
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
      /* still pipeline */
    }

    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('image load failed'))
      img.src = url
    })

    return decodeStillImageFromBitmap(reader, img)
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
  initialStatus = '실시간 탭에서 카메라를 비추면 바로 읽습니다.',
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
        delayBetweenScanAttempts: 60,
        delayBetweenScanSuccess: 280,
        tryPlayVideoTimeout: 12_000,
      })
    }
    return readerRef.current
  }, [])

  const emitDecoded = useCallback(async (raw: string) => {
    const text = normalizeBarcodePayload(raw)
    if (!text) return
    const now = Date.now()
    if (text === lastText.current && now - lastAt.current < 2200) return
    lastText.current = text
    lastAt.current = now
    await Promise.resolve(onDecodeRef.current(text)).catch(() => {})
  }, [])

  useEffect(() => {
    if (scanMode !== 'live') return

    const reader = new BrowserMultiFormatReader(buildScannerHints(), {
      delayBetweenScanAttempts: 60,
      delayBetweenScanSuccess: 280,
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
        /* */
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
          setTimeout(() => reject(new Error('timeout')), 12_000),
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
          video: { facingMode: 'environment', width: { min: 640 }, height: { min: 480 } },
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
          const scale = computeDecodeScale(vw, vh, UPSCALE_MAX)
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
            try {
              drawBinarized(ctx, videoEl, 0, 0, vw, vh, 0, 0, canvas.width, canvas.height, 128)
              const result = reader.decodeFromCanvas(canvas)
              onResult(result)
            } catch {
              /* */
            }
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
            video: { deviceId: { exact: back }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          })
        } catch {
          setStatus('웹 카메라를 쓸 수 없습니다. 「사진으로 읽기」에서 기본 카메라를 이용하세요.')
          return
        }
      }

      BrowserCodeReader.addVideoSource(videoEl, stream)
      try {
        await tryPlayVideoWithTimeout(videoEl)
      } catch {
        setStatus('영상을 시작하지 못했습니다.')
        stream.getTracks().forEach(t => t.stop())
        stream = null
        BrowserCodeReader.cleanVideoSource(videoEl)
        return
      }

      setStatus('코드를 화면 중앙에 맞추면 바로 인식합니다 · 밝게·가깝게')
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
    async (file: File | undefined, source: 'camera' | 'gallery') => {
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
      let decodedOk = false
      try {
        const reader = getReader()
        const text = (await decodeImageFile(file, reader)).trim()
        if (!text) {
          setStatus('코드를 찾지 못했습니다. 1D 바코드는 가로로 길게·선명하게 찍어 보세요.')
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
        decodedOk = true
        setStatus(
          scanMode === 'live' && source === 'camera'
            ? '다음 장 촬영창을 엽니다…'
            : '다음 코드를 찍거나 선택하세요.',
        )
      } catch {
        setStatus('인식하지 못했습니다. 밝은 곳에서 초점을 맞춰 보세요.')
      } finally {
        setBusy(false)
        if (cameraInputRef.current) cameraInputRef.current.value = ''
        if (galleryInputRef.current) galleryInputRef.current.value = ''
      }

      if (decodedOk && scanMode === 'live' && source === 'camera') {
        window.setTimeout(() => cameraInputRef.current?.click(), 280)
      }
    },
    [getReader, scanMode],
  )

  return (
    <div className={`rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-lg ${className}`}>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={e => void handleFile(e.target.files?.[0], 'camera')}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="sr-only"
        tabIndex={-1}
        onChange={e => void handleFile(e.target.files?.[0], 'gallery')}
      />

      <div className="flex border-b border-slate-800 bg-slate-950">
        <button
          type="button"
          onClick={() => {
            setScanMode('live')
            setStatus('카메라 시작 중…')
          }}
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
          onClick={() => {
            setScanMode('photo')
            setStatus('촬영 또는 앨범에서 고화질 사진을 고르세요.')
          }}
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
        <div className="relative bg-black">
          <video ref={videoRef} className={videoClassName} playsInline muted autoPlay />
          <div className="border-t border-slate-800 bg-slate-950 px-3 py-2 flex flex-col gap-2">
            <p className="text-[11px] text-slate-500 text-center leading-snug">
              웹 미리보기가 잘 안 되면 <strong className="text-slate-300">기본 카메라 앱</strong>으로 고화질 촬영
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => cameraInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 text-sm py-2"
            >
              <Camera className="w-4 h-4" />
              기본 카메라로 촬영
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-h-[min(42vh,320px)] min-h-[200px] flex flex-col items-center justify-center bg-slate-950 text-slate-300 px-4 py-6">
          <p className="text-sm text-center mb-4 max-w-sm leading-relaxed">
            <strong className="text-slate-100">기본 카메라</strong>로 찍거나 <strong className="text-slate-100">앨범</strong>
            에서 선택하세요. 1D 바코드는 막대가 잘리지 않게 가로로 담아 주세요.
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
