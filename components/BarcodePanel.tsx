'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import type { Item } from '@/lib/supabase/types'
import { buildItemLabelVariants } from '@/lib/items/labelVariants'
import {
  is1DBarcodePayloadLossy,
  normalizeBarcodePayload,
  to1DBarcodeSafeString,
} from '@/lib/items/barcodePayload'
import { Loader2, Package, PencilLine, Printer } from 'lucide-react'

type LabelPreset = {
  key: string
  label: string
  widthMm: number
  heightMm: number
}

const LABEL_PRESETS: LabelPreset[] = [
  { key: '40x20', label: '40 × 20mm', widthMm: 40, heightMm: 20 },
  { key: '40x30', label: '40 × 30mm', widthMm: 40, heightMm: 30 },
  { key: '50x30', label: '50 × 30mm', widthMm: 50, heightMm: 30 },
  { key: '50.8x101.6', label: '2×4in (50.8 × 101.6mm)', widthMm: 50.8, heightMm: 101.6 },
  { key: '58x40', label: '58 × 40mm (기본)', widthMm: 58, heightMm: 40 },
  { key: '70x50', label: '70 × 50mm', widthMm: 70, heightMm: 50 },
  { key: '100x60', label: '100 × 60mm', widthMm: 100, heightMm: 60 },
  { key: '101.6x101.6', label: '4×4in (101.6mm)', widthMm: 101.6, heightMm: 101.6 },
  { key: '101.6x152.4', label: '4×6in (101.6 × 152.4mm)', widthMm: 101.6, heightMm: 152.4 },
  { key: '100x50', label: '100 × 50mm', widthMm: 100, heightMm: 50 },
]

/** 본문(캡션·메타)에 쓸 여백을 최소화해 바코드 영역을 최대화 */
function labelBarcodeMaxHeightMm(heightMm: number): number {
  const pad = 1.2
  const textReserve = Math.min(10, heightMm * 0.26)
  return Math.max(5, heightMm - textReserve - pad * 2)
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 열전사 203dpi — 인쇄용 PNG가 물리 mm와 맞물리도록 */
const DPMM_203 = 203 / 25.4

/** 인쇄용: 축소 시 부드러운 보간을 끄면 막대 경계가 유지되어 스캔이 잘 됨 */
function scaleCanvasToMax(
  source: HTMLCanvasElement,
  maxWPx: number,
  maxHPx: number,
  sharp: boolean = false
): HTMLCanvasElement {
  const w = source.width
  const h = source.height
  if (w <= 0 || h <= 0) return source
  const scale = Math.min(maxWPx / w, maxHPx / h, 1)
  if (scale >= 0.999) return source
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(w * scale))
  out.height = Math.max(1, Math.round(h * scale))
  const ctx = out.getContext('2d')
  if (!ctx) return source
  ctx.imageSmoothingEnabled = !sharp
  if (!sharp) ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, out.width, out.height)
  return out
}

/** 숨김 iframe 인쇄 전용 — 본 페이지 @page 와 충돌하지 않음 */
function buildPrintIframeStyles(widthMm: number, heightMm: number, barcodeMaxMm: number): string {
  const pad = 1.2
  return `
      @page {
        size: ${widthMm}mm ${heightMm}mm;
        margin: 0 !important;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      html {
        margin: 0;
        padding: 0;
        width: ${widthMm}mm;
        height: auto;
        min-height: ${heightMm}mm;
        overflow: visible;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
        width: ${widthMm}mm;
        height: auto !important;
        min-height: ${heightMm}mm;
        max-height: none !important;
        background: #fff;
        overflow: visible;
      }
      .label {
        width: ${widthMm}mm;
        height: ${heightMm}mm;
        min-height: ${heightMm}mm;
        max-height: ${heightMm}mm;
        margin: 0;
        padding: ${pad}mm;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        gap: 0.25mm;
        overflow: hidden;
        page-break-after: always;
        break-after: page;
      }
      .label:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .caption {
        margin: 0;
        font-size: 6pt;
        line-height: 1.05;
        text-align: center;
        flex-shrink: 0;
      }
      .meta {
        margin: 0;
        font-size: 5.5pt;
        line-height: 1.05;
        text-align: center;
        word-break: break-all;
        flex-shrink: 0;
      }
      .barcode-wrap {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
      }
      .barcode {
        display: block;
        width: 100%;
        max-width: 100%;
        height: auto;
        max-height: ${barcodeMaxMm}mm;
        object-fit: contain;
        object-position: center center;
        image-rendering: auto;
      }
      .barcode-crisp {
        image-rendering: crisp-edges;
      }
      @media print {
        @page {
          size: ${widthMm}mm ${heightMm}mm;
          margin: 0 !important;
        }
        html, body {
          width: ${widthMm}mm !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow: visible !important;
        }
      }
  `
}

function getItemLabelRows(item: Item, sep: string) {
  return buildItemLabelVariants(item, sep).filter(row => row.payload)
}

function sanitizeFilePart(s: string): string {
  return s.slice(0, 48).replace(/[/\\?%*:|"<>]/g, '-').trim() || 'item'
}

type CodeFormat = 'CODE128' | 'CODE39' | 'QR'

function oneDModuleWidth(format: CodeFormat): number {
  return format === 'CODE39' ? 3 : 2
}

function BarcodeStrip({
  payload,
  format,
  caption,
  metaLines = [],
  showEncodingLine = true,
  paperHeightMm = 40,
}: {
  payload: string
  format: CodeFormat
  caption?: string
  metaLines?: string[]
  showEncodingLine?: boolean
  paperHeightMm?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const compactLabel = paperHeightMm <= 24
  const barcodeHeight = compactLabel ? 34 : Math.max(46, Math.floor(paperHeightMm * 2.8))
  const normalizedMeta =
    compactLabel && metaLines.length > 0
      ? [metaLines.join(' / ')]
      : metaLines

  useEffect(() => {
    const canvas = ref.current
    const p = normalizeBarcodePayload(payload)
    if (!canvas || !p) return

    if (format === 'QR') {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      const side = Math.min(280, Math.max(96, Math.round(paperHeightMm * 6)))
      void QRCode.toCanvas(canvas, p, {
        width: side,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      }).catch(() => {})
      return
    }

    const line = to1DBarcodeSafeString(p)
    if (!line) return

    const quiet = Math.max(12, compactLabel ? 10 : 16)
    const moduleWidth = oneDModuleWidth(format)

    try {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      try {
        JsBarcode(canvas, line, {
          format,
          width: moduleWidth,
          height: barcodeHeight,
          displayValue: false,
          margin: quiet,
          fontSize: compactLabel ? 8 : 10,
        })
      } catch {
        if (format === 'CODE39') {
          JsBarcode(canvas, line, {
            format: 'CODE128',
            width: 2,
            height: barcodeHeight,
            displayValue: false,
            margin: quiet,
            fontSize: compactLabel ? 8 : 10,
          })
        }
      }
    } catch {
      /* invalid */
    }
  }, [payload, format, barcodeHeight, compactLabel, paperHeightMm])

  return (
    <div
      className="barcode-print-label flex flex-col items-center justify-center gap-1 border-b border-slate-100 last:border-0 print:break-inside-avoid"
      style={{
        width: '100%',
        minHeight: '180px',
        padding: '10px',
      }}
    >
      {caption && (
        <p className="text-xs print:text-[7pt] font-medium text-slate-700 text-center max-w-full truncate px-1">{caption}</p>
      )}
      {normalizedMeta.length > 0 && (
        <div className="text-[11px] print:text-[6.5pt] text-slate-600 text-center leading-tight px-1 space-y-0.5">
          {normalizedMeta.map(line => (
            <p key={line} className="break-all">
              {line}
            </p>
          ))}
        </div>
      )}
      {showEncodingLine && (
        <div className="text-[11px] print:text-[6.5pt] text-slate-500 text-center px-1 max-w-full space-y-0.5">
          <p className="break-all">
            {format === 'QR'
              ? payload
              : (() => {
                  const safe = to1DBarcodeSafeString(payload)
                  return is1DBarcodePayloadLossy(payload, safe)
                    ? `${safe} · (한글 등은 1D에 미포함 — QR 권장)`
                    : safe
                })()}
          </p>
        </div>
      )}
      <canvas
        ref={ref}
        className="max-w-full h-auto"
        style={
          format === 'QR'
            ? {
                width: `${Math.min(280, Math.max(96, Math.round(paperHeightMm * 6)))}px`,
                height: `${Math.min(280, Math.max(96, Math.round(paperHeightMm * 6)))}px`,
                maxHeight: 'min(40vh, 280px)',
              }
            : {
                width: 'min(96%, 560px)',
                maxHeight: compactLabel ? '84px' : '130px',
              }
        }
      />
    </div>
  )
}

export function BarcodePanel() {
  const [mode, setMode] = useState<'items' | 'manual'>('items')
  const [shPrefix, setShPrefix] = useState('')
  const [serial, setSerial] = useState('')
  const [sep, setSep] = useState('|')
  const [format, setFormat] = useState<CodeFormat>('CODE39')
  const [paperKey, setPaperKey] = useState<string>('58x40')

  const [items, setItems] = useState<Item[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')

  const manualPayload = [shPrefix.trim(), serial.trim()].filter(Boolean).join(sep || '|')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) {
        setItemsLoading(false)
        return
      }
      const { data } = await supabase.from('items').select('*').eq('user_id', user.id).order('name')
      if (!cancelled) {
        setItems((data ?? []) as Item[])
        setItemsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const s = sep || '|'
    setSelected(prev => {
      const next = new Set<string>()
      prev.forEach(id => {
        const item = items.find(i => i.id === id)
        if (item && getItemLabelRows(item, s).length > 0) next.add(id)
      })
      return next
    })
  }, [sep, items])

  const filteredItems = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      i =>
        i.name.toLowerCase().includes(q) ||
        (i.barcode_code?.toLowerCase().includes(q) ?? false) ||
        (i.sh?.toLowerCase().includes(q) ?? false) ||
        (i.serial_number?.toLowerCase().includes(q) ?? false)
    )
  }, [items, filter])

  const selectedList = useMemo(() => items.filter(i => selected.has(i.id)), [items, selected])

  const itemRows = useMemo(
    () =>
      selectedList.flatMap(item =>
        getItemLabelRows(item, sep || '|').map(row => ({
          item,
          unitIndex: row.index,
          payload: row.payload!,
          barcode: row.barcode,
          serial: row.serial,
        }))
      ),
    [selectedList, sep]
  )

  const validItemRows = itemRows

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllFiltered = useCallback(() => {
    setSelected(prev => {
      const next = new Set(prev)
      const s = sep || '|'
      filteredItems.forEach(i => {
        if (getItemLabelRows(i, s).length > 0) next.add(i.id)
      })
      return next
    })
  }, [filteredItems, sep])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const drawToBlob = useCallback(
    (payload: string): Promise<Blob | null> => {
      const p = normalizeBarcodePayload(payload)
      if (!p) return Promise.resolve(null)

      if (format === 'QR') {
        return (async () => {
          const canvas = document.createElement('canvas')
          try {
            await QRCode.toCanvas(canvas, p, {
              width: 360,
              margin: 2,
              errorCorrectionLevel: 'H',
              color: { dark: '#000000', light: '#ffffff' },
            })
            return await new Promise<Blob | null>(resolve => {
              canvas.toBlob(blob => resolve(blob), 'image/png')
            })
          } catch {
            return null
          }
        })()
      }

      const line = to1DBarcodeSafeString(p)
      if (!line) return Promise.resolve(null)
      const moduleWidth = oneDModuleWidth(format)

      return new Promise(resolve => {
        const canvas = document.createElement('canvas')
        try {
          try {
            JsBarcode(canvas, line, {
              format,
              width: moduleWidth,
              height: 100,
              displayValue: true,
              margin: 16,
            })
          } catch {
            if (format === 'CODE39') {
              JsBarcode(canvas, line, {
                format: 'CODE128',
                width: 2,
                height: 100,
                displayValue: true,
                margin: 14,
              })
            } else {
              resolve(null)
              return
            }
          }
          canvas.toBlob(b => resolve(b), 'image/png')
        } catch {
          resolve(null)
        }
      })
    },
    [format]
  )

  /**
   * 인쇄 iframe 전용 — 1D: 203dpi·쿼트존·선명 축소. QR: 슬롯에 맞는 정사각 고해상도.
   */
  const drawToDataUrlForPrint = useCallback(
    async (payload: string, labelWidthMm: number, labelHeightMm: number): Promise<string | null> => {
      const clean = normalizeBarcodePayload(payload)
      if (!clean) return null

      const padMm = 1.2
      const barcodeMaxMm = labelBarcodeMaxHeightMm(labelHeightMm)
      const maxWPx = Math.max(64, Math.round((labelWidthMm - padMm * 2) * DPMM_203))
      const maxHPx = Math.max(40, Math.round(barcodeMaxMm * DPMM_203))

      if (format === 'QR') {
        const side = Math.max(128, Math.round(Math.min(maxWPx, maxHPx)))
        try {
          return await QRCode.toDataURL(clean, {
            width: side,
            margin: 2,
            errorCorrectionLevel: 'H',
            color: { dark: '#000000', light: '#ffffff' },
          })
        } catch {
          return null
        }
      }

      const line = to1DBarcodeSafeString(clean)
      if (!line) return null

      const barHeight = Math.min(220, Math.max(40, Math.floor(maxHPx * 0.88)))
      const quietPx = Math.max(30, Math.round(maxWPx * 0.14))

      const probe = document.createElement('canvas')
      let bestModule = format === 'CODE39' ? 3 : 2
      let bestFit = -1

      const tryProbe = (moduleW: 4 | 3 | 2 | 1) => {
        try {
          const ctx = probe.getContext('2d')
          if (ctx) ctx.clearRect(0, 0, probe.width, probe.height)
          JsBarcode(probe, line, {
            format,
            width: moduleW,
            height: barHeight,
            displayValue: false,
            margin: quietPx,
          })
          const fit = Math.min(maxWPx / probe.width, maxHPx / probe.height, 1)
          if (fit > bestFit + 1e-4 || (Math.abs(fit - bestFit) < 1e-4 && moduleW > bestModule)) {
            bestFit = fit
            bestModule = moduleW
          }
        } catch {
          /* try next */
        }
      }

      const moduleCandidates: Array<4 | 3 | 2> = format === 'CODE39' ? [4, 3, 2] : [3, 2]
      for (const moduleW of moduleCandidates) tryProbe(moduleW)
      if (bestFit < 0) tryProbe(1)
      if (bestFit < 0) return null

      const canvas = document.createElement('canvas')
      const draw = (fmt: 'CODE128' | 'CODE39') =>
        JsBarcode(canvas, line, {
          format: fmt,
          width: bestModule,
          height: barHeight,
          displayValue: false,
          margin: quietPx,
        })

      try {
        try {
          draw(format as 'CODE128' | 'CODE39')
        } catch {
          if (format === 'CODE39') draw('CODE128')
          else throw new Error('barcode')
        }
        const scaled = scaleCanvasToMax(canvas, maxWPx, maxHPx, true)
        return scaled.toDataURL('image/png')
      } catch {
        return null
      }
    },
    [format]
  )

  const triggerDownload = (blob: Blob, filename: string) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const downloadPng = async () => {
    if (mode === 'manual') {
      if (!manualPayload) return
      const blob = await drawToBlob(manualPayload)
      if (blob) triggerDownload(blob, `barcode-${sanitizeFilePart(manualPayload)}.png`)
      return
    }
    if (validItemRows.length === 0) return
    for (let i = 0; i < validItemRows.length; i++) {
      const { item, payload, unitIndex } = validItemRows[i]
      const blob = await drawToBlob(payload)
      if (blob) {
        triggerDownload(blob, `barcode-${sanitizeFilePart(item.name)}-${String(unitIndex).padStart(3, '0')}.png`)
        await new Promise(r => setTimeout(r, 250))
      }
    }
  }

  const canPrint = mode === 'manual' ? !!manualPayload : validItemRows.length > 0
  const canDownload = canPrint

  const paperPreset = useMemo(
    () => LABEL_PRESETS.find(p => p.key === paperKey) ?? LABEL_PRESETS[0],
    [paperKey]
  )
  const wMm = paperPreset.widthMm
  const hMm = paperPreset.heightMm
  const printBarcodeMaxHeightMm = useMemo(() => labelBarcodeMaxHeightMm(hMm), [hMm])

  async function printBarcode() {
    if (mode === 'manual' && !manualPayload) return
    if (mode === 'items' && validItemRows.length === 0) return

    const labels =
      mode === 'manual'
        ? [
            {
              caption: '',
              metaLines: [] as string[],
              payload: manualPayload,
            },
          ]
        : validItemRows.map(({ item, payload, unitIndex, serial }) => ({
            caption: `${item.name} #${unitIndex}`,
            metaLines: [
              item.sh ? `SH: ${item.quantity > 1 ? `${item.sh}-${String(unitIndex).padStart(3, '0')}` : item.sh}` : '',
              serial ? `Serial: ${serial}` : '',
            ].filter(Boolean),
            payload,
          }))

    const parts: string[] = []
    for (const label of labels) {
      const dataUrl = await drawToDataUrlForPrint(label.payload, wMm, hMm)
      if (!dataUrl) continue
      const captionHtml = label.caption ? `<p class="caption">${escapeHtml(label.caption)}</p>` : ''
      const metaHtml = label.metaLines.map(line => `<p class="meta">${escapeHtml(line)}</p>`).join('')
      parts.push(`
          <section class="label">
            ${captionHtml}
            ${metaHtml}
            <div class="barcode-wrap">
              <img class="barcode${format !== 'QR' ? ' barcode-crisp' : ''}" src="${dataUrl}" alt="" />
            </div>
          </section>
        `)
    }
    const htmlLabels = parts.join('')

    if (!htmlLabels) return

    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    Object.assign(iframe.style, {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      width: `${Math.max(320, Math.ceil(wMm * 4))}px`,
      height: `${Math.max(400, Math.ceil(hMm * 4 * Math.max(1, labels.length)))}px`,
      border: '0',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '-1',
    })
    document.body.appendChild(iframe)

    const frameDoc = iframe.contentDocument
    const frameWin = iframe.contentWindow
    if (!frameDoc || !frameWin) {
      iframe.remove()
      return
    }

    frameDoc.open()
    frameDoc.write(`<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>Barcode</title>
    <style>${buildPrintIframeStyles(wMm, hMm, printBarcodeMaxHeightMm)}</style>
  </head>
  <body>${htmlLabels}</body>
</html>`)
    frameDoc.close()

    const finalize = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          frameWin.focus()
          frameWin.print()
          setTimeout(() => iframe.remove(), 1500)
        })
      })
    }

    const images = Array.from(frameDoc.images)
    if (images.length === 0) {
      setTimeout(finalize, 100)
      return
    }
    let pending = images.length
    const onDone = () => {
      pending -= 1
      if (pending <= 0) setTimeout(finalize, 100)
    }
    images.forEach(img => {
      if (img.complete) onDone()
      else {
        img.addEventListener('load', onDone, { once: true })
        img.addEventListener('error', onDone, { once: true })
      }
    })
  }

  return (
    <div className="space-y-4 rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
      <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
        <button
          type="button"
          onClick={() => setMode('items')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
            mode === 'items' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <Package className="w-4 h-4 shrink-0" />
          등록 품목
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
            mode === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <PencilLine className="w-4 h-4 shrink-0" />
          직접 입력
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm text-slate-600 mb-1">구분자 (직접·품목 공통)</label>
          <input
            value={sep}
            onChange={e => setSep(e.target.value)}
            className="w-20 rounded-xl border border-slate-200 px-2 py-2 text-sm text-center"
            maxLength={4}
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">포맷</label>
          <select
            value={format}
            onChange={e => setFormat(e.target.value as CodeFormat)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="CODE128">CODE128 (1D 바코드)</option>
            <option value="CODE39">CODE39</option>
            <option value="QR">QR코드 (2D·카메라 스캔)</option>
          </select>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            QR은 같은 값도 패턴이 커서 라벨에 잘 보이고, 휴대폰 카메라로 읽기 쉽습니다. 레이저 1D 스캐너만 있으면 CODE128을 쓰세요.
          </p>
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">라벨 용지 (가로×세로 mm)</label>
          <select
            value={paperKey}
            onChange={e => setPaperKey(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white min-w-[200px]"
          >
            {LABEL_PRESETS.map(p => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed">
            <strong className="text-slate-700">바로 인쇄</strong>는 선택한 {wMm}×{hMm}mm 전용 페이지로 열립니다. 프린터에서도
            같은 사용자 정의 용지를 쓰고, <strong className="text-slate-700">배율 100%</strong>·&quot;페이지에 맞춤&quot; 끔을 권장합니다.
          </p>
        </div>
      </div>

      {mode === 'items' ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            품목 라벨 값은 <strong className="text-slate-800">SH / 시리얼 / 바코드</strong> 중{' '}
            <strong className="text-slate-800">가장 짧은 값</strong>을 우선 사용해 1D 인식률을 높입니다.
          </p>
          {itemsLoading ? (
            <div className="flex justify-center py-8 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              등록된 품목이 없습니다. 품목 추가 후 이용하세요.
            </p>
          ) : (
            <>
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="이름·바코드·SH·시리얼 검색"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  목록 전체 선택
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs font-medium text-slate-600 hover:underline"
                >
                  선택 해제
                </button>
                <span className="text-xs text-slate-500 ml-auto">
                  선택 {validItemRows.length}개
                </span>
              </div>
              <div className="max-h-[min(52vh,360px)] overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {filteredItems.map(item => {
                  const pCount = getItemLabelRows(item, sep || '|').length
                  const checked = selected.has(item.id)
                  return (
                    <label
                      key={item.id}
                      className={`flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50 ${
                        pCount > 0 ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={pCount === 0}
                        checked={checked}
                        onChange={() => pCount > 0 && toggle(item.id)}
                        className="mt-1 rounded border-slate-300"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {pCount > 0 ? (
                            <>
                              재고 기준 라벨: <span className="font-mono text-slate-700">{pCount}개</span>
                            </>
                          ) : (
                            <span className="text-amber-700">바코드·SH·시리얼 중 하나 이상 필요</span>
                          )}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            SH·시리얼을 넣으면 <code className="text-xs bg-slate-100 px-1 rounded">{sep || '|'}</code> 로 이어
            CODE128/CODE39 또는 QR코드로 만듭니다.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-slate-600 mb-1">SH / 접두어</label>
              <input
                value={shPrefix}
                onChange={e => setShPrefix(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                placeholder="예: MIC-900"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">시리얼</label>
              <input
                value={serial}
                onChange={e => setSerial(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                placeholder="예: SN2026001"
              />
            </div>
          </div>
        </>
      )}

      <div id="barcode-print-area" className="rounded-xl bg-slate-50 border border-slate-200 p-4 overflow-x-auto print:border-0 print:bg-white">
        {mode === 'manual' ? (
          <>
            <div className="flex justify-center min-h-[120px] items-center">
              {manualPayload ? (
                <BarcodeStrip
                  payload={manualPayload}
                  format={format}
                  showEncodingLine={false}
                  paperHeightMm={hMm}
                />
              ) : (
                <span className="text-slate-400 text-sm">값을 입력하면 미리보기가 나옵니다.</span>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3 print:text-slate-800">
              선택한 품목별 바코드 ({validItemRows.length}개)
            </p>
            <div className="flex flex-col gap-0">
              {validItemRows.length === 0 ? (
                <span className="text-slate-400 text-sm text-center py-8">
                  품목을 선택하세요. (바코드 값 또는 SH·시리얼이 있는 품목만 인쇄됩니다)
                </span>
              ) : (
                validItemRows.map(({ item, payload, unitIndex, serial }) => (
                  <BarcodeStrip
                    key={`${item.id}-${unitIndex}`}
                    payload={payload}
                    format={format}
                    caption={`${item.name} #${unitIndex}`}
                    metaLines={[
                      item.sh ? `SH: ${item.quantity > 1 ? `${item.sh}-${String(unitIndex).padStart(3, '0')}` : item.sh}` : '',
                      serial ? `Serial: ${serial}` : '',
                    ].filter(Boolean)}
                    showEncodingLine={false}
                    paperHeightMm={hMm}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={!canPrint}
          onClick={() => void printBarcode()}
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white font-medium py-3 shadow-sm disabled:opacity-40 active:scale-[0.99]"
        >
          <Printer className="w-5 h-5 shrink-0" aria-hidden />
          바로 인쇄
        </button>
        <button
          type="button"
          disabled={!canDownload}
          onClick={() => void downloadPng()}
          className="rounded-xl bg-blue-600 text-white font-medium py-3 shadow-sm disabled:opacity-40"
        >
          {mode === 'items' && validItemRows.length > 1
            ? `PNG ${validItemRows.length}개 다운로드`
            : 'PNG 다운로드'}
        </button>
      </div>
      <p className="text-xs text-slate-500 text-center">
        인쇄는 미리보기와 별도로 고해상도 바코드를 용지 한 장에 맞춥니다. 어긋나면 용지 크기·여백 0·배율 100%를 다시 확인하세요.
      </p>
    </div>
  )
}
