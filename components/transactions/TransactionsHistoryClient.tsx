'use client'

import {
  updateInventoryEventAction,
  updateStockTransactionAction,
} from '@/app/(dashboard)/transactions/actions'
import { Loader2, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

export type HistoryRow =
  | {
      kind: 'stock'
      key: string
      rawId: string
      created_at: string
      title: string
      subtitle: string
      detailLines: string[]
      amountText: string
      amountClass: string
      direction: 'in' | 'out'
      amount: number
      note: string
      project: string
    }
  | {
      kind: 'inventory'
      key: string
      rawId: string
      created_at: string
      title: string
      subtitle: string
      detailLines: string[]
      amountText: string
      amountClass: string
      event_type: 'item_create' | 'item_delete'
      item_name: string
      quantity: number
      detail: string
      kindLabel: string
    }

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function TransactionsHistoryClient({ rows }: { rows: HistoryRow[] }) {
  const router = useRouter()
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [rows]
  )

  const onSaveStock = useCallback(
    async (rawId: string, key: string, formData: FormData) => {
      setBusy(key)
      const res = await updateStockTransactionAction(rawId, formData)
      setBusy(null)
      if (!res.ok) {
        alert(res.error)
        return
      }
      setEditingKey(null)
      router.refresh()
    },
    [router]
  )

  const onSaveInv = useCallback(
    async (rawId: string, key: string, formData: FormData) => {
      setBusy(key)
      const res = await updateInventoryEventAction(rawId, formData)
      setBusy(null)
      if (!res.ok) {
        alert(res.error)
        return
      }
      setEditingKey(null)
      router.refresh()
    },
    [router]
  )

  return (
    <ul className="space-y-2">
      {sorted.map(tx => (
        <li
          key={tx.key}
          className="rounded-2xl bg-white border border-slate-200 px-4 py-3 shadow-sm flex justify-between gap-3 text-sm"
        >
          {editingKey === tx.key ? (
            <div className="w-full space-y-2">
              {tx.kind === 'stock' ? (
                <form
                  className="space-y-2"
                  action={fd => void onSaveStock(tx.rawId, tx.key, fd)}
                >
                  <p className="text-xs font-medium text-slate-700">{tx.title}</p>
                  <p className="text-[11px] text-slate-500">
                    구분: {tx.direction === 'in' ? '입고' : '출고'} · 수량 {tx.direction === 'in' ? '+' : '−'}
                    {tx.amount} (금액은 입출고 화면 기록 기준입니다)
                  </p>
                  <label className="block text-xs text-slate-500">
                    일시
                    <input
                      name="created_at"
                      type="datetime-local"
                      defaultValue={toDatetimeLocalValue(tx.created_at)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
                      required
                    />
                  </label>
                  <label className="block text-xs text-slate-500">
                    프로젝트/현장
                    <input
                      name="project"
                      type="text"
                      defaultValue={tx.project}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
                    />
                  </label>
                  <label className="block text-xs text-slate-500">
                    메모
                    <input
                      name="note"
                      type="text"
                      defaultValue={tx.note}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
                    />
                  </label>
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingKey(null)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={busy === tx.key}
                      className="rounded-lg bg-blue-600 text-white px-3 py-1 text-xs font-medium disabled:opacity-50"
                    >
                      {busy === tx.key ? <Loader2 className="w-4 h-4 animate-spin" /> : '저장'}
                    </button>
                  </div>
                </form>
              ) : (
                <form
                  className="space-y-2"
                  action={fd => void onSaveInv(tx.rawId, tx.key, fd)}
                >
                  <label className="block text-xs text-slate-500">
                    품목명
                    <input
                      name="item_name"
                      type="text"
                      defaultValue={tx.item_name}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
                      required
                    />
                  </label>
                  <label className="block text-xs text-slate-500">
                    일시
                    <input
                      name="created_at"
                      type="datetime-local"
                      defaultValue={toDatetimeLocalValue(tx.created_at)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
                      required
                    />
                  </label>
                  <label className="block text-xs text-slate-500">
                    수량
                    <input
                      name="quantity"
                      type="number"
                      min={0}
                      defaultValue={tx.quantity}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
                    />
                  </label>
                  <label className="block text-xs text-slate-500">
                    메모/상세
                    <input
                      name="detail"
                      type="text"
                      defaultValue={tx.detail}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
                    />
                  </label>
                  <p className="text-[11px] text-slate-400">{tx.kindLabel}</p>
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingKey(null)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={busy === tx.key}
                      className="rounded-lg bg-blue-600 text-white px-3 py-1 text-xs font-medium disabled:opacity-50"
                    >
                      {busy === tx.key ? <Loader2 className="w-4 h-4 animate-spin" /> : '저장'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 truncate">{tx.title}</p>
                <p className="text-xs text-slate-400">
                  {new Date(tx.created_at).toLocaleString('ko-KR')}
                  {tx.subtitle ? ` · ${tx.subtitle}` : ''}
                </p>
                {tx.detailLines.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {tx.detailLines.map(line => (
                      <p key={`${tx.key}-${line}`} className="text-[11px] text-slate-500 break-all">
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <span className={`inline-block font-semibold tabular-nums ${tx.amountClass}`}>
                  {tx.amountText}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingKey(tx.key)}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  수정
                </button>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
