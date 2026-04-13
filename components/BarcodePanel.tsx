'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { createClient } from '@/lib/supabase/client'
import type { Item } from '@/lib/supabase/types'
import { buildItemLabelVariants } from '@/lib/items/labelVariants'
import { Loader2, Package, PencilLine, Printer } from 'lucide-react'

type LabelPreset = {
  key: string
  label: string
  widthMm: number
  heightMm: number
}

const LABEL_PRESETS: LabelPreset[] = [
  { key: '40x20', label: '40 x 20mm (기본)', widthMm: 40, heightMm: 20 },
  { key: '40x30', label: '40 x 30mm', widthMm: 40, heightMm: 30 },
  { key: '50x30', label: '50 x 30mm', widthMm: 50, heightMm: 30 },
  { key: '50.8x101.6', label: '2 x 4in (50.8 x 101.6mm)', widthMm: 50.8, heightMm: 101.6 },
  { key: '58x40', label: '58 x 40mm', widthMm: 58, heightMm: 40 },
  { key: '70x50', label: '70 x 50mm', widthMm: 70, heightMm: 50 },
  { key: '100x60', label: '100 x 60mm (USER)', widthMm: 100, heightMm: 60 },
  { key: '101.6x101.6', label: '4 x 4in (101.6 x 101.6mm)', widthMm: 101.6, heightMm: 101.6 },
  { key: '101.6x152.4', label: '4 x 6in (101.6 x 152.4mm)', widthMm: 101.6, heightMm: 152.4 },
  { key: '100x50', label: '100 x 50mm', widthMm: 100, heightMm: 50 },
]

function getItemLabelRows(item: Item, sep: string) {
  return buildItemLabelVariants(item, sep).filter(row => row.payload)
}

function sanitizeFilePart(s: string): string {
  return s.slice(0, 48).replace(/[/\\?%*:|"<>]/g, '-').trim() || 'item'
}

function BarcodeStrip({
  payload,
  format,
  caption,
  showEncodingLine = true,
  paperWidthMm,
  paperHeightMm,
}: {
  payload: string
  format: 'CODE128' | 'CODE39'
  caption?: string
  showEncodingLine?: boolean
  paperWidthMm: number
  paperHeightMm: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const barcodeHeight = Math.max(38, Math.floor(paperHeightMm * 2.1))

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !payload) return
    try {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      JsBarcode(canvas, payload, {
        format,
        width: 2,
        height: barcodeHeight,
        displayValue: true,
        margin: 4,
        fontSize: 10,
      })
    } catch {
      /* invalid */
    }
  }, [payload, format, barcodeHeight])

  return (
    <div
      className="barcode-print-label flex flex-col items-center justify-center gap-1 border-b border-slate-100 last:border-0 print:break-inside-avoid"
      style={{
        width: `${paperWidthMm}mm`,
        minHeight: `${paperHeightMm}mm`,
        padding: '2mm 1.5mm',
      }}
    >
      {caption && (
        <p className="text-[10px] print:text-[8pt] font-medium text-slate-700 text-center max-w-full truncate px-1">{caption}</p>
      )}
      {showEncodingLine && (
        <p className="text-[10px] print:text-[8pt] text-slate-500 break-all text-center px-1 max-w-full">{payload}</p>
      )}
      <canvas ref={ref} className="max-w-full h-auto" style={{ width: `${Math.round(paperWidthMm * 0.9)}mm` }} />
    </div>
  )
}

export function BarcodePanel() {
  const [mode, setMode] = useState<'items' | 'manual'>('items')
  const [shPrefix, setShPrefix] = useState('')
  const [serial, setSerial] = useState('')
  const [sep, setSep] = useState('|')
  const [format, setFormat] = useState<'CODE128' | 'CODE39'>('CODE128')
  const [paperKey, setPaperKey] = useState<string>('40x20')

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
      return new Promise(resolve => {
        const canvas = document.createElement('canvas')
        try {
          JsBarcode(canvas, payload, {
            format,
            width: 2,
            height: 100,
            displayValue: true,
            margin: 10,
          })
          canvas.toBlob(b => resolve(b), 'image/png')
        } catch {
          resolve(null)
        }
      })
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

  function printBarcode() {
    if (mode === 'manual' && !manualPayload) return
    if (mode === 'items' && validItemRows.length === 0) return
    requestAnimationFrame(() => window.print())
  }

  const canPrint =
    mode === 'manual' ? !!manualPayload : validItemRows.length > 0
  const canDownload = canPrint
  const paperPreset = LABEL_PRESETS.find(p => p.key === paperKey) ?? LABEL_PRESETS[0]

  return (
    <div className="space-y-4 rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  @page { margin: 0; size: ${paperPreset.widthMm}mm ${paperPreset.heightMm}mm; }
  body * { visibility: hidden !important; }
  #barcode-print-area, #barcode-print-area * { visibility: visible !important; }
  #barcode-print-area {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: ${paperPreset.widthMm}mm !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: flex-start !important;
    padding: 0 !important;
    background: white !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  #barcode-print-area .barcode-print-label {
    width: ${paperPreset.widthMm}mm !important;
    min-height: ${paperPreset.heightMm}mm !important;
    page-break-after: always !important;
    break-after: page !important;
    border: 0 !important;
  }
  #barcode-print-area .barcode-print-label:last-child {
    page-break-after: auto !important;
    break-after: auto !important;
  }
  #barcode-print-area canvas {
    max-width: 100% !important;
    height: auto !important;
  }
}
`,
        }}
      />

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
            onChange={e => setFormat(e.target.value as 'CODE128' | 'CODE39')}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="CODE128">CODE128 (권장)</option>
            <option value="CODE39">CODE39</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Xprinter 용지</label>
          <select
            value={paperKey}
            onChange={e => setPaperKey(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
          >
            {LABEL_PRESETS.map(p => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mode === 'items' ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            품목에 저장된 <strong className="text-slate-800">바코드 값</strong>이 있으면 그대로 쓰고, 없으면{' '}
            <strong className="text-slate-800">SH</strong>와 <strong className="text-slate-800">시리얼</strong>을
            구분자로 이어 붙입니다.
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
            CODE128/CODE39 바코드를 만듭니다.
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
            <p className="text-xs text-slate-500 mb-2 break-all print:text-slate-800 print:text-sm">
              인코딩 값:{' '}
              <strong className="text-slate-800">{manualPayload || '(비어 있음)'}</strong>
            </p>
            <div className="flex justify-center min-h-[120px] items-center">
              {manualPayload ? (
                <BarcodeStrip
                  payload={manualPayload}
                  format={format}
                  showEncodingLine={false}
                  paperWidthMm={paperPreset.widthMm}
                  paperHeightMm={paperPreset.heightMm}
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
                validItemRows.map(({ item, payload, unitIndex }) => (
                  <BarcodeStrip
                    key={`${item.id}-${unitIndex}`}
                    payload={payload}
                    format={format}
                    caption={`${item.name} #${unitIndex}`}
                    paperWidthMm={paperPreset.widthMm}
                    paperHeightMm={paperPreset.heightMm}
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
          onClick={printBarcode}
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
        인쇄 시 인쇄 창에서 라벨 프린터·복합기를 선택하면 됩니다. 여러 품목이면 한 용지에 순서대로 나옵니다.
      </p>
    </div>
  )
}
