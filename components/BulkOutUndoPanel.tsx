'use client'

import { deleteStockTransactionsBatchAction } from '@/app/(dashboard)/move-bulk/actions'
import { buildTransactionQrDetailLines } from '@/lib/items/transactionQrDisplay'
import { Loader2, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

export type UndoOutboundRow = {
  id: string
  created_at: string
  project: string
  amount: number
  lot_code: string | null
  item_name: string
  item_barcode: string | null
}

type Props = {
  dayLabel: string
  rows: UndoOutboundRow[]
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

export function BulkOutUndoPanel({ dayLabel, rows }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(() => new Set(rows.map(r => r.id)))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const byProject = useMemo(() => {
    const map = new Map<string, UndoOutboundRow[]>()
    for (const row of rows) {
      const key = row.project.trim() || '(프로젝트 없음)'
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ko'))
  }, [rows])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectProject = (projectKey: string, on: boolean) => {
    const group = byProject.find(([k]) => k === projectKey)?.[1] ?? []
    setSelected(prev => {
      const next = new Set(prev)
      for (const row of group) {
        if (on) next.add(row.id)
        else next.delete(row.id)
      }
      return next
    })
  }

  const runUndo = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) {
      setMsg({ type: 'err', text: '되돌릴 출고를 선택하세요.' })
      return
    }
    if (
      !window.confirm(
        `선택한 ${ids.length}건의 출고 이력을 삭제하고 재고를 되돌릴까요?\n\n삭제 후 아래에서 QR을 다시 스캔해 일괄 출고하세요.`,
      )
    ) {
      return
    }

    setBusy(true)
    setMsg(null)
    const res = await deleteStockTransactionsBatchAction(ids)
    setBusy(false)
    if (!res.ok) {
      setMsg({ type: 'err', text: res.error })
      return
    }
    const failNote = res.failed.length > 0 ? ` (실패 ${res.failed.length}건)` : ''
    setMsg({ type: 'ok', text: `${res.deleted}건 되돌림 완료${failNote}. QR을 다시 스캔해 출고하세요.` })
    router.refresh()
  }

  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        오늘({dayLabel}) 등록된 출고 이력이 없습니다.
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 space-y-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-amber-950 flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            오늘 출고 되돌리기 ({dayLabel})
          </h2>
          <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
            잘못된 일괄 출고(FIFO로 기록된 건)를 선택 삭제하면 재고가 복구됩니다. 이후 위에서 QR을 다시 스캔해
            출고하면 라벨 번호와 전산 번호가 일치합니다.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => void runUndo()}
          className="rounded-lg bg-amber-700 text-white px-3 py-2 text-sm font-medium disabled:opacity-50 shrink-0"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `선택 ${selected.size}건 되돌리기`}
        </button>
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

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {byProject.map(([projectKey, group]) => (
          <div key={projectKey} className="rounded-xl border border-amber-200/80 bg-white overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-100/60 border-b border-amber-200/60">
              <p className="text-sm font-medium text-amber-950">{projectKey}</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => selectProject(projectKey, true)}
                  className="text-[11px] rounded-md border border-amber-300 px-2 py-0.5 text-amber-900"
                >
                  전체 선택
                </button>
                <button
                  type="button"
                  onClick={() => selectProject(projectKey, false)}
                  className="text-[11px] rounded-md border border-amber-300 px-2 py-0.5 text-amber-900"
                >
                  선택 해제
                </button>
              </div>
            </div>
            <ul className="divide-y divide-slate-100">
              {group.map(row => {
                const qrLine = buildTransactionQrDetailLines(row.lot_code, row.item_barcode, row.amount)[0] ?? ''
                return (
                  <li key={row.id} className="px-3 py-2 flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-medium text-slate-900">{row.item_name}</p>
                      <p className="text-slate-600 mt-0.5">
                        {formatTime(row.created_at)} · 수량 {row.amount}
                        {qrLine ? ` · ${qrLine.replace('QR 코드: ', '')}` : ''}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
