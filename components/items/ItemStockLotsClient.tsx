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
    async (lotId: string) => {
      if (!window.confirm('이 입고 단위를 삭제할까요? 수량만큼 재고에서 빠집니다.')) return
      setBusy(lotId)
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
        <p className="text-xs font-medium text-slate-600">입고 추가 (날짜·시간을 바꿀 수 있습니다)</p>
        <form id="add-lot-form" action={fd => void onAdd(fd)} className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-500 sm:col-span-2">
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
            입고 단위 추가
          </button>
        </form>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500">등록된 입고 단위가 없습니다. 위에서 추가하거나 품목 수정에서 수량을 맞추세요.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map(lot => (
            <li
              key={lot.id}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm flex flex-col gap-2"
            >
              {editingId === lot.id ? (
                <form
                  action={fd => void onUpdate(lot.id, fd)}
                  className="space-y-2"
                >
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
                <div className="flex justify-between gap-2 items-start">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 tabular-nums">{lot.quantity}개</p>
                    <p className="text-xs text-slate-500">
                      {new Date(lot.created_at).toLocaleString('ko-KR')}
                    </p>
                    {lot.note ? <p className="text-xs text-slate-600 mt-1 break-all">{lot.note}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(lot.id)}
                      className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                      aria-label="수정"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={busy === lot.id}
                      onClick={() => void onDelete(lot.id)}
                      className="p-2 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      aria-label="삭제"
                    >
                      {busy === lot.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
