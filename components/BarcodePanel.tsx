'use client'

import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'

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

  return (
    <div className="space-y-4 rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
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

      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 overflow-x-auto">
        <p className="text-xs text-slate-500 mb-2 break-all">
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

      <button
        type="button"
        disabled={!payload}
        onClick={downloadPng}
        className="w-full rounded-xl bg-blue-600 text-white font-medium py-3 shadow-sm disabled:opacity-40"
      >
        PNG 다운로드
      </button>
    </div>
  )
}
