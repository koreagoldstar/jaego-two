'use client'

import {
  addItemQuantityLegacy,
  clearItemQuantityLegacy,
  deleteItemStockByItemQrLegacy,
} from '@/app/(dashboard)/items/[id]/itemStockLegacyActions'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

type Props = {
  itemId: string
  quantity: number
  /** 품목에 등록된 QR — 삭제 시 이 값과 일치해야 함 */
  itemBarcode: string | null
}

export function ItemStockLegacyClient({ itemId, quantity, itemBarcode }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const onAdd = useCallback(
    async (formData: FormData) => {
      setBusy('add')
      const res = await addItemQuantityLegacy(itemId, formData)
      setBusy(null)
      if (!res.ok) {
        alert(res.error)
        return
      }
      ;(document.getElementById('legacy-add-form') as HTMLFormElement | null)?.reset()
      router.refresh()
    },
    [itemId, router]
  )

  const onDeleteByQr = useCallback(
    async (formData: FormData) => {
      if (!window.confirm('품목에 등록된 QR과 같으면 보유 재고를 0으로 만듭니다. 계속할까요?')) return
      setBusy('del-qr')
      const res = await deleteItemStockByItemQrLegacy(itemId, formData)
      setBusy(null)
      if (!res.ok) {
        alert(res.error)
        return
      }
      ;(document.getElementById('legacy-delete-qr-form') as HTMLFormElement | null)?.reset()
      router.refresh()
    },
    [itemId, router]
  )

  const onClear = useCallback(async () => {
    if (!window.confirm('보유 재고를 모두(0개)로 만들까요?')) return
    setBusy('clear')
    const res = await clearItemQuantityLegacy(itemId)
    setBusy(null)
    if (!res.ok) {
      alert(res.error)
      return
    }
    router.refresh()
  }, [itemId, router])

  const registered = (itemBarcode ?? '').trim()

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 space-y-2">
        <p className="text-xs font-medium text-amber-900">QR로 재고 삭제 (레거시)</p>
        <p className="text-[11px] text-amber-800/90">
          입고 단위 DB가 없을 때는 품목에 등록된 QR과 일치하면 재고 전체를 0으로 맞춥니다. 입고별 삭제는 007·009 마이그레이션 후 입고 단위 화면을 쓰세요.
        </p>
        {registered ? (
          <p className="text-[11px] text-slate-600 break-all">
            등록된 품목 QR: <span className="font-mono">{registered}</span>
          </p>
        ) : (
          <p className="text-[11px] text-red-700">품목에 QR이 없습니다. 품목 수정에서 QR을 넣으세요.</p>
        )}
        <form
          id="legacy-delete-qr-form"
          action={fd => void onDeleteByQr(fd)}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="text-xs text-amber-900 min-w-[12rem] flex-1">
            확인용 QR
            <input
              name="delete_qr"
              type="text"
              autoComplete="off"
              disabled={!registered || quantity < 1}
              className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm disabled:opacity-50"
              placeholder="스캔 또는 직접 입력"
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy === 'del-qr' || !registered || quantity < 1}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            {busy === 'del-qr' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            재고 0으로
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-3 space-y-2">
        <p className="text-xs font-medium text-slate-600">재고 추가</p>
        <form id="legacy-add-form" action={fd => void onAdd(fd)} className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">
            개수
            <input
              name="add_qty"
              type="number"
              min={1}
              defaultValue={1}
              className="mt-1 block w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm tabular-nums"
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy === 'add'}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            추가
          </button>
        </form>
      </div>

      {quantity > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 space-y-3">
          <div className="flex justify-between gap-2 items-start">
            <div>
              <p className="font-semibold text-slate-900 tabular-nums">보유 재고 {quantity}개</p>
              <p className="text-[11px] text-slate-500 mt-1">입고 단위 DB 없이 합산 재고만 관리합니다.</p>
            </div>
            <button
              type="button"
              disabled={busy === 'clear'}
              onClick={() => void onClear()}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {busy === 'clear' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              전부 삭제
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">현재 재고가 0개입니다. 위에서 추가하세요.</p>
      )}
    </div>
  )
}
