'use client'

import type { ItemLabelVariant } from '@/lib/items/labelVariants'
import { deleteItemLabelUnitAction } from '@/app/(dashboard)/items/[id]/labelStockActions'
import { Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

type Props = {
  itemId: string
  labelRows: ItemLabelVariant[]
  /** true면 합산(items.quantity)만 줄임 */
  legacyStockMode: boolean
}

export function ItemLabelStockListClient({ itemId, labelRows, legacyStockMode }: Props) {
  const router = useRouter()
  const [busyIndex, setBusyIndex] = useState<number | null>(null)

  const onDeleteOne = useCallback(
    async (labelIndex: number, barcode: string | null) => {
      const hint = barcode ? ` (${barcode})` : ''
      if (!window.confirm(`라벨 #${labelIndex}${hint}에 해당하는 재고 1개를 삭제할까요?`)) return
      setBusyIndex(labelIndex)
      const fd = new FormData()
      fd.set('label_index', String(labelIndex))
      const res = await deleteItemLabelUnitAction(itemId, fd)
      setBusyIndex(null)
      if (!res.ok) {
        alert(res.error)
        return
      }
      router.refresh()
    },
    [itemId, router]
  )

  return (
    <div className="space-y-2">
      {!legacyStockMode ? (
        <p className="text-[11px] text-slate-500">
          삭제 시 <span className="font-medium text-slate-700">가장 오래된 입고부터</span> 한 개씩 줄입니다. 라벨 #1은 그 첫 번째 단위입니다.
        </p>
      ) : (
        <p className="text-[11px] text-slate-500">입고 단위 DB 없이 보유 수량만 1개 줄입니다.</p>
      )}
      <ul className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
        {labelRows.map(row => (
          <li
            key={`${itemId}-label-${row.index}`}
            className="px-3 py-2 text-xs text-slate-700 flex gap-2 items-start justify-between"
          >
            <div className="min-w-0 space-y-1 flex-1">
              <p className="font-medium text-slate-900">#{row.index}</p>
              {row.barcode ? <p className="break-all">QR 코드값: {row.barcode}</p> : null}
              {row.payload ? <p className="text-slate-500 break-all">인쇄값: {row.payload}</p> : null}
            </div>
            <button
              type="button"
              disabled={busyIndex === row.index}
              onClick={() => void onDeleteOne(row.index, row.barcode)}
              className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {busyIndex === row.index ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
