'use client'

import type { ItemStockLot } from '@/lib/supabase/types'
import {
  addItemStockLotAction,
  deleteItemStockLotAction,
  updateItemStockLotAction,
} from '@/app/(dashboard)/items/[id]/stockLotsActions'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

type Props = {
  itemId: string
  lots: ItemStockLot[]
}

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ItemStockLotsClient({ itemId, lots }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...lots].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [lots]
  )

  const onAdd = useCallback(
    async (formData: FormData) => {
      setBusy('add')
      const res = await addItemStockLotAction(itemId, formData)
      setBusy(null)
      if (!res.ok) {
        alert(res.error)
        return
      }
      const form = document.getElementById('add-lot-form') as HTMLFormElement | null
      form?.reset()
      router.refresh()
    },
    [itemId, router]
  )

  const onUpdate = useCallback(
    async (lotId: string, formData: FormData) => {
      setBusy(lotId)
      const res = await updateItemStockLotAction(itemId, lotId, formData)
      setBusy(null)
      if (!res.ok) {
        alert(res.error)
        return
      }
      setEditingId(null)
      router.refresh()
    },
    [itemId, router]
  )

  const onDelete = useCallback(
    async (lotId: string, qty: number) => {
      if (!window.confirm(`이 입고(총 ${qty}개)를 통째로 삭제할까요?`)) return
      setBusy(`del-${lotId}`)
      const res = await deleteItemStockLotAction(itemId, lotId)
      setBusy(null)
      if (!res.ok) {
        alert(res.error)
        return
      }
      router.refresh()
    },
    [itemId, router]
  )

  const nowLocal = useMemo(() => toDatetimeLocalValue(new Date().toISOString()), [])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-3 space-y-2">
        <p className="text-xs font-medium text-slate-600">재고 추가 (QR·입고일·메모)</p>
        <form id="add-lot-form" action={fd => void onAdd(fd)} className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-500">
            수량
            <input
              name="quantity"
              type="number"
              min={1}
              defaultValue={1}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
              required
            />
          </label>
          <label className="text-xs text-slate-500">
            이 입고의 QR
            <input
              name="lot_code"
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
              placeholder="라벨에 찍을 값"
              required
            />
          </label>
          <label className="text-xs text-slate-500 sm:col-span-2">
            입고일시
            <input
              name="created_at"
              type="datetime-local"
              defaultValue={nowLocal}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-slate-500 sm:col-span-2">
            메모 (선택)
            <input
              name="note"
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
              placeholder="예: 1차 입고"
            />
          </label>
          <button
            type="submit"
            disabled={busy === 'add'}
            className="sm:col-span-2 inline-flex items-center justify-center gap-1 rounded-lg bg-slate-800 text-white text-sm font-medium py-2 hover:bg-slate-900 disabled:opacity-50"
          >
            {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            재고 추가
          </button>
        </form>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500">등록된 입고 단위가 없습니다. 위에서 추가하거나 품목 수정에서 수량을 맞추세요.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map(lot => {
            const hasQr = Boolean((lot.lot_code ?? '').trim())
            return (
              <li
                key={lot.id}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm flex flex-col gap-2"
              >
                {editingId === lot.id ? (
                  <form action={fd => void onUpdate(lot.id, fd)} className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="text-xs text-slate-500">
                        수량
                        <input
                          name="quantity"
                          type="number"
                          min={1}
                          defaultValue={lot.quantity}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
                          required
                        />
                      </label>
                      <label className="text-xs text-slate-500">
                        QR
                        <input
                          name="lot_code"
                          type="text"
                          defaultValue={lot.lot_code ?? ''}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
                          required
                        />
                      </label>
                      <label className="text-xs text-slate-500 sm:col-span-2">
                        입고일시
                        <input
                          name="created_at"
                          type="datetime-local"
                          defaultValue={toDatetimeLocalValue(lot.created_at)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
                          required
                        />
                      </label>
                      <label className="text-xs text-slate-500 sm:col-span-2">
                        메모
                        <input
                          name="note"
                          type="text"
                          defaultValue={lot.note ?? ''}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
                        />
                      </label>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        disabled={busy === lot.id}
                        className="rounded-lg bg-blue-600 text-white px-3 py-1 text-xs font-medium disabled:opacity-50"
                      >
                        저장
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between gap-2 items-start">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 tabular-nums">{lot.quantity}개</p>
                        {hasQr ? (
                          <p className="text-xs text-slate-700 mt-0.5 break-all">
                            <span className="text-slate-500">QR:</span> {lot.lot_code}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            QR 없음 — 한 개만 줄이려면 아래「재고 수량 기준 라벨」에서 삭제하세요.
                          </p>
                        )}
                        <p className="text-xs text-slate-500">
                          {new Date(lot.created_at).toLocaleString('ko-KR')}
                        </p>
                        {lot.note ? <p className="text-xs text-slate-600 mt-1 break-all">{lot.note}</p> : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingId(lot.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          수정
                        </button>
                        <button
                          type="button"
                          disabled={busy === `del-${lot.id}`}
                          onClick={() => void onDelete(lot.id, lot.quantity)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          {busy === `del-${lot.id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          입고 삭제
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
