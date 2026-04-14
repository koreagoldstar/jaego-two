'use client'

import { useCallback, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { Camera, ImageIcon, Loader2 } from 'lucide-react'

const UPSCALE_CANVAS_MAX = 2560
const UPSCALE_MIN = 1.5
const UPSCALE_MAX = 2.5

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
    return r.getText().trim()
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
      const text = result.getText().trim()
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

type Props = {
  onDecode: (text: string) => void | Promise<void>
  initialStatus?: string
  className?: string
  /** 상단 안내 영역에 적용 (기존 미리보기 영역과 동일 용도) */
  videoClassName?: string
}

export function BarcodeCamera({
  onDecode,
  initialStatus = '휴대폰 기본 카메라로 촬영하거나 사진을 선택하세요.',
  className = '',
  videoClassName = 'w-full max-h-[min(42vh,320px)] min-h-[200px] flex flex-col items-center justify-center bg-slate-950 text-slate-300',
}: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const lastAt = useRef(0)
  const lastText = useRef('')
  const onDecodeRef = useRef(onDecode)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const [status, setStatus] = useState(initialStatus)
  const [busy, setBusy] = useState(false)

  onDecodeRef.current = onDecode

  const getReader = useCallback(() => {
    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader(buildScannerHints(), {
        tryPlayVideoTimeout: 12_000,
      })
    }
    return readerRef.current
  }, [])

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file || !file.type.startsWith('image/')) {
        setStatus('이미지 파일을 선택해 주세요.')
        return
      }

      setBusy(true)
      setStatus('이미지에서 코드 읽는 중…')
      try {
        const reader = getReader()
        const text = (await decodeImageFile(file, reader)).trim()
        if (!text) {
          setStatus('바코드·QR을 찾지 못했습니다. 더 가깝고 선명하게 찍어 보세요.')
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
        setStatus('다음 코드를 촬영하거나 선택하세요.')
      } catch {
        setStatus('바코드·QR을 인식하지 못했습니다. 밝은 곳에서 초점 맞춰 다시 찍어 보세요.')
      } finally {
        setBusy(false)
        if (cameraInputRef.current) cameraInputRef.current.value = ''
        if (galleryInputRef.current) galleryInputRef.current.value = ''
      }
    },
    [getReader],
  )

  return (
    <div className={`rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-lg ${className}`}>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={e => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={e => void handleFile(e.target.files?.[0])}
      />

      <div className={videoClassName}>
        <p className="text-sm text-center px-4 mb-4 max-w-sm leading-relaxed">
          웹 카메라 대신 <strong className="text-slate-100">휴대폰 기본 카메라 앱</strong>으로 찍은 사진을 사용합니다.
          <br />
          바코드·QR이 선명하게 보이게 촬영해 주세요.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm px-4">
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

      <div className="bg-slate-900 text-slate-200 text-sm px-4 py-3 flex items-center gap-2 min-h-[3rem]">
        {busy && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        <span className="break-all">{status}</span>
      </div>
    </div>
  )
}
