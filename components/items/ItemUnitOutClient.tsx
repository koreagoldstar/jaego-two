'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatStockUnitLabel, type StockUnitOption } from '@/lib/items/stockUnits'
import { Loader2 } from 'lucide-react'

type Props = {
  itemId: string
  itemName: string
  units: StockUnitOption[]
}

export function ItemUnitOutClient({ itemId, itemName, units }: Props) {
  const router = useRouter()
  const [project, setProject] = useState('')
  const [note, setNote] = useState('')
  const [busyLotId, setBusyLotId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const runOut = useCallback(
    async (unit: StockUnitOption) => {
      const label = formatStockUnitLabel(unit)
      if (
        !window.confirm(
          `${itemName}\n${label}\n\n이 재고 1개를 출고할까요?${project.trim() ? `\n프로젝트: ${project.trim()}` : ''}`
        )
      ) {
        return
      }
      setMsg(null)
      setBusyLotId(unit.lotId)
      const supabase = createClient()
      const { error } = await supabase.rpc('apply_stock_move', {
        p_item_id: itemId,
        p_direction: 'out',
        p_amount: 1,
        p_note: note.trim() || null,
        p_project: project.trim() || null,
        p_lot_id: unit.lotId,
      })
      setBusyLotId(null)
      if (error) {
        setMsg({ type: 'err', text: error.message })
        return
      }
      setMsg({ type: 'ok', text: `${label} 출고 완료` })
      router.refresh()
    },
    [itemId, itemName, note, project, router]
  )

  if (units.length === 0) {
    return <p className="text-sm text-slate-500">출고할 재고가 없습니다.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">단위별로 바로 출고할 수 있습니다. 번호(#)는 QR 순번과 같습니다.</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={project}
          onChange={e => setProject(e.target.value)}
          placeholder="프로젝트/현장 (선택)"
          className="col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="메모 (선택)"
          className="col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <ul className="rounded-xl border border-slate-200 divide-y divide-slate-100">
        {units.map(unit => (
          <li key={unit.lotId} className="flex items-center justify-between gap-2 px-3 py-2.5">
            <span className="text-sm text-slate-800 break-all min-w-0">{formatStockUnitLabel(unit)}</span>
            <button
              type="button"
              disabled={busyLotId !== null}
              onClick={() => void runOut(unit)}
              className="shrink-0 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-2 disabled:opacity-50"
            >
              {busyLotId === unit.lotId ? <Loader2 className="w-4 h-4 animate-spin" /> : '출고'}
            </button>
          </li>
        ))}
      </ul>
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
      <a
        href={`/move?item=${itemId}`}
        className="block text-center text-sm text-blue-600 font-medium"
      >
        입·출고 화면에서 더 처리 →
      </a>
    </div>
  )
}
