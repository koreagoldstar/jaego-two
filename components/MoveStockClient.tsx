'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { findItemIdByBarcode } from '@/lib/items/barcodeLookup'
import type { Item } from '@/lib/supabase/types'
import { BarcodeCamera } from '@/components/BarcodeCamera'
import { ChevronDown, Loader2, X } from 'lucide-react'

export function MoveStockClient() {
  const searchParams = useSearchParams()
  const preItem = searchParams.get('item')

  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>('')
  const [amount, setAmount] = useState(1)
  const [project, setProject] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [scanLine, setScanLine] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)

  const resolveRef = useRef<(code: string) => Promise<void>>(async () => {})

  const load = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('items').select('*').eq('user_id', user.id).order('name')
    setItems((data ?? []) as Item[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (preItem && items.some(i => i.id === preItem)) {
      setSelectedId(preItem)
      setScanLine('URL로 품목이 지정되었습니다.')
    }
  }, [preItem, items])

  const resolveBarcode = useCallback(async (code: string) => {
    setMsg(null)
    const trimmed = code.trim()
    if (!trimmed) return

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const id = await findItemIdByBarcode(supabase, user.id, trimmed)
    if (id) {
      setSelectedId(id)
      setScanLine(`스캔: ${trimmed}`)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(35)
      }
      return
    }
    setMsg({ type: 'err', text: `등록되지 않은 바코드: ${trimmed}` })
  }, [])

  resolveRef.current = resolveBarcode

  /** 무선 바코드 건(키보드 입력처럼 들어옴) */
  useEffect(() => {
    let buffer = ''
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.closest('input, textarea, select') || el?.isContentEditable) return

      if (e.key === 'Enter') {
        const code = buffer.trim()
        buffer = ''
        if (code.length >= 2) {
          e.preventDefault()
          void resolveRef.current(code)
        }
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer += e.key
        if (buffer.length > 128) buffer = buffer.slice(-128)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const selected = useMemo(() => items.find(i => i.id === selectedId), [items, selectedId])

  async function run(direction: 'in' | 'out') {
    setMsg(null)
    if (!selectedId || amount < 1) {
      setMsg({ type: 'err', text: '바코드로 품목을 먼저 선택하세요.' })
      return
    }
    setBusy(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('apply_stock_move', {
      p_item_id: selectedId,
      p_direction: direction,
      p_amount: amount,
      p_note: note.trim() || null,
      p_project: project.trim() || null,
    })
    setBusy(false)
    if (error) {
      setMsg({ type: 'err', text: error.message })
      return
    }
    if (data) {
      setMsg({ type: 'ok', text: direction === 'in' ? '입고 완료' : '출고 완료' })
      setNote('')
      await load()
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-slate-500 leading-relaxed px-1">
        카메라로 비추거나, 무선 스캐너로 찍으면 품목이 잡힙니다. 그다음 수량·입고/출고만 누르면 됩니다.
      </p>

      <BarcodeCamera onDecode={resolveBarcode} videoClassName="w-full max-h-[min(38vh,280px)] object-cover" />

      {scanLine && (
        <p className="text-center text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-100 rounded-xl py-2 px-3">
          {scanLine}
        </p>
      )}

      {selected ? (
        <div className="rounded-2xl bg-slate-900 text-white p-4 shadow-md space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 uppercase tracking-wide">선택된 품목</p>
              <p className="text-lg font-bold leading-snug truncate">{selected.name}</p>
              <p className="text-sm text-slate-300 tabular-nums mt-1">현재 재고 {selected.quantity}</p>
              {(selected.barcode_code || selected.serial_number) && (
                <p className="text-xs text-slate-500 mt-1 truncate">
                  {selected.barcode_code && <span>바코드 {selected.barcode_code}</span>}
                  {selected.barcode_code && selected.serial_number && ' · '}
                  {selected.serial_number && <span>시리얼 {selected.serial_number}</span>}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedId('')
                setScanLine(null)
                setMsg(null)
              }}
              className="shrink-0 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              aria-label="선택 해제"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-6 text-center text-sm text-slate-600">
          아직 품목이 없습니다. 바코드를 스캔하세요.
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowPicker(s => !s)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
      >
        <span>직접 품목 고르기 (스캔 없이)</span>
        <ChevronDown className={`w-5 h-5 shrink-0 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
      </button>

      {showPicker && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <label className="block text-sm font-medium text-slate-700 mb-2">품목</label>
          <select
            value={selectedId}
            onChange={e => {
              setSelectedId(e.target.value)
              setScanLine(e.target.value ? '목록에서 선택했습니다.' : null)
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
          >
            <option value="">선택…</option>
            {items.map(i => (
              <option key={i.id} value={i.id}>
                {i.name} (재고 {i.quantity})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
        <label className="block text-sm font-medium text-slate-700">프로젝트 / 현장</label>
        <input
          value={project}
          onChange={e => setProject(e.target.value)}
          placeholder="예: OO방송, A행사"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
        <label className="block text-sm font-medium text-slate-700">수량</label>
        <div className="flex gap-2 flex-wrap">
          {[1, 5, 10, 50].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setAmount(n)}
              className={`rounded-xl px-4 py-2 text-sm font-medium border ${
                amount === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 border-slate-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={e => setAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="w-full rounded-xl border border-slate-200 px-3 py-3 text-lg font-semibold tabular-nums"
        />
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 mb-1">메모 (선택)</label>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="비고"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
      </div>

      {msg && (
        <p
          className={`text-sm rounded-xl px-3 py-2 ${
            msg.type === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
              : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          disabled={busy || !selectedId}
          onClick={() => run('in')}
          className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-5 text-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          입고
        </button>
        <button
          type="button"
          disabled={busy || !selectedId}
          onClick={() => run('out')}
          className="rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-semibold py-5 text-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          출고
        </button>
      </div>
    </div>
  )
}
