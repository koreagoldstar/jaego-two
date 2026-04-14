'use client'

import { useCallback, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { Camera, ImageIcon, Loader2, ScanLine } from 'lucide-react'
import { normalizeBarcodePayload } from '@/lib/items/barcodePayload'

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

/** 실시간 = 기본 카메라 연속 촬영, 사진 = 카메라+앨범 */
type ScanMode = 'live' | 'photo'

type Props = {
  onDecode: (text: string) => void | Promise<void>
  initialStatus?: string
  className?: string
  /** 상단 안내 영역 (웹 미리보기 대신 패널 높이·배경) */
  videoClassName?: string
}

export function BarcodeCamera({
  onDecode,
  initialStatus = '기본 카메라로 촬영한 뒤 「사진 사용」을 누르면 바로 읽습니다.',
  className = '',
  videoClassName = 'w-full max-h-[min(42vh,320px)] min-h-[200px] flex flex-col items-center justify-center bg-slate-950 text-slate-300 px-4 py-6',
}: Props) {
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
        tryPlayVideoTimeout: 12_000,
      })
    }
    return readerRef.current
  }, [])

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
        decodedOk = true
        setStatus(
          scanMode === 'live' && source === 'camera'
            ? '다음 장을 찍으려면 잠시 후 카메라가 다시 열립니다…'
            : '다음 코드를 찍거나 선택하세요.',
        )
      } catch {
        setStatus('인식하지 못했습니다. 밝은 곳에서 초점을 맞춰 보세요.')
      } finally {
        setBusy(false)
        if (cameraInputRef.current) cameraInputRef.current.value = ''
        if (galleryInputRef.current) galleryInputRef.current.value = ''
      }

      /* 웹 미리보기 없이 기본 카메라만 쓰는 「연속」느낌 — 일부 브라우저는 자동 재오픈을 막을 수 있음 */
      if (decodedOk && scanMode === 'live' && source === 'camera') {
        window.setTimeout(() => {
          cameraInputRef.current?.click()
        }, 280)
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
            setStatus('휴대폰 기본 카메라로 찍은 사진을 바로 읽습니다. 연속 작업은 촬영 후 자동으로 다시 열립니다.')
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

      <div className={videoClassName}>
        {scanMode === 'live' ? (
          <>
            <p className="text-sm text-center mb-4 max-w-sm leading-relaxed">
              <strong className="text-slate-100">웹 카메라 미리보기는 사용하지 않습니다.</strong> 휴대폰에 설치된{' '}
              <strong className="text-slate-100">카메라 앱</strong>으로 찍은 그대로를 읽습니다. 한 장 처리 후 같은
              방식으로 바로 다음 장을 찍을 수 있습니다.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => cameraInputRef.current?.click()}
              className="w-full max-w-sm flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-3 px-4 transition-colors"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5 shrink-0" />}
              기본 카메라로 촬영
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-center mb-4 max-w-sm leading-relaxed">
              <strong className="text-slate-100">기본 카메라</strong>로 새로 찍거나, <strong className="text-slate-100">앨범</strong>
              에서 기존 사진을 고를 수 있습니다.
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
          </>
        )}
      </div>

      <div className="bg-slate-900 text-slate-200 text-sm px-4 py-3 flex items-center gap-2 min-h-[3rem]">
        {busy && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        <span className="break-all">{status}</span>
      </div>
    </div>
  )
}
