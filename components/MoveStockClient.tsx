'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Item } from '@/lib/supabase/types'
import { Loader2 } from 'lucide-react'

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
    }
  }, [preItem, items])

  const selected = useMemo(() => items.find(i => i.id === selectedId), [items, selectedId])

  async function run(direction: 'in' | 'out') {
    setMsg(null)
    if (!selectedId || amount < 1) {
      setMsg({ type: 'err', text: '품목과 수량을 확인하세요.' })
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
      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
        <label className="block text-sm font-medium text-slate-700">프로젝트 / 현장</label>
        <input
          value={project}
          onChange={e => setProject(e.target.value)}
          placeholder="예: OO방송 촬영, A행사 출고"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
        <p className="text-xs text-slate-400">어떤 프로젝트로 들어오거나 나가는지 적어 두면 이력에서 구분할 수 있습니다.</p>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
        <label className="block text-sm font-medium text-slate-700">품목</label>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
        >
          <option value="">선택…</option>
          {items.map(i => (
            <option key={i.id} value={i.id}>
              {i.name} (재고 {i.quantity})
            </option>
          ))}
        </select>
        {selected && (
          <p className="text-xs text-slate-500">
            바코드: {selected.barcode_code || '—'} · 시리얼: {selected.serial_number || '—'}
          </p>
        )}
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
            msg.type === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => run('in')}
          className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 text-lg shadow-sm disabled:opacity-50"
        >
          입고
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run('out')}
          className="rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 text-lg shadow-sm disabled:opacity-50"
        >
          출고
        </button>
      </div>
    </div>
  )
}
