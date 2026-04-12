'use client'

import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { Printer } from 'lucide-react'

export function BarcodePanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sku, setSku] = useState('')
  const [serial, setSerial] = useState('')
  const [sep, setSep] = useState('|')
  const [format, setFormat] = useState<'CODE128' | 'CODE39'>('CODE128')

  const payload = [sku.trim(), serial.trim()].filter(Boolean).join(sep || '|')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !payload) return
    try {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      JsBarcode(canvas, payload, {
        format,
        width: 2,
        height: 100,
        displayValue: true,
        margin: 10,
      })
    } catch {
      /* invalid payload for symbology */
    }
  }, [payload, format])

  function downloadPng() {
    const canvas = canvasRef.current
    if (!canvas || !payload) return
    canvas.toBlob(blob => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `barcode-${payload.slice(0, 24).replace(/[/\\?%*:|"<>]/g, '-')}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    }, 'image/png')
  }

  /** 시스템 인쇄 대화상자 — PC에 연결된 라벨/일반 프린터 선택 가능 */
  function printBarcode() {
    if (!payload) return
    requestAnimationFrame(() => {
      window.print()
    })
  }

  return (
    <div className="space-y-4 rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  @page { margin: 10mm; size: auto; }
  body * { visibility: hidden !important; }
  #barcode-print-area, #barcode-print-area * { visibility: visible !important; }
  #barcode-print-area {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: flex-start !important;
    padding: 8mm !important;
    background: white !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  #barcode-print-area canvas { max-width: 100% !important; height: auto !important; }
}
`,
        }}
      />
      <p className="text-sm text-slate-600">
        SKU·품번과 시리얼을 함께 넣으면 <code className="text-xs bg-slate-100 px-1 rounded">{sep || '|'}</code> 로
        이어서 CODE128 바코드로 만듭니다.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm text-slate-600 mb-1">SKU / 접두어</label>
          <input
            value={sku}
            onChange={e => setSku(e.target.value)}
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
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm text-slate-600 mb-1">구분자</label>
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
      </div>

      <div
        id="barcode-print-area"
        className="rounded-xl bg-slate-50 border border-slate-200 p-4 overflow-x-auto print:border-0 print:bg-white"
      >
        <p className="text-xs text-slate-500 mb-2 break-all print:text-slate-800 print:text-sm">
          인코딩 값: <strong className="text-slate-800">{payload || '(비어 있음)'}</strong>
        </p>
        <div className="flex justify-center min-h-[120px] items-center">
          {payload ? (
            <canvas ref={canvasRef} className="max-w-full" />
          ) : (
            <span className="text-slate-400 text-sm">값을 입력하면 미리보기가 나옵니다.</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={!payload}
          onClick={printBarcode}
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white font-medium py-3 shadow-sm disabled:opacity-40 active:scale-[0.99]"
        >
          <Printer className="w-5 h-5 shrink-0" aria-hidden />
          바로 인쇄
        </button>
        <button
          type="button"
          disabled={!payload}
          onClick={downloadPng}
          className="rounded-xl bg-blue-600 text-white font-medium py-3 shadow-sm disabled:opacity-40"
        >
          PNG 다운로드
        </button>
      </div>
      <p className="text-xs text-slate-500 text-center">
        인쇄 시 Windows/맥 인쇄 창에서 <strong className="text-slate-600">라벨 프린터·복합기</strong>를 선택하면 됩니다.
      </p>
    </div>
  )
}
