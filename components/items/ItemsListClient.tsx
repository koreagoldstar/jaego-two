'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import type { Item } from '@/lib/supabase/types'
import { deleteItemsAction } from '@/app/(dashboard)/items/actions'
import { ChevronRight, Loader2, Trash2 } from 'lucide-react'

type Props = {
  items: Item[]
}

export function ItemsListClient({ items }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(item =>
      [
        item.name,
        item.barcode_code ?? '',
        item.location ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [items, query])

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelected(prev => {
      const next = new Set(prev)
      filteredItems.forEach(i => next.add(i.id))
      return next
    })
  }, [filteredItems])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const count = selected.size

  const onDeleteSelected = useCallback(async () => {
    if (count === 0) return
    const ok = window.confirm(
      `선택한 ${count}개 품목을 삭제할까요?\n삭제 내역은 이력에 남고, 연결된 입출고 이력은 함께 삭제됩니다.`
    )
    if (!ok) return
    setBusy(true)
    const res = await deleteItemsAction(Array.from(selected))
    setBusy(false)
    if (!res.ok) {
      alert(res.error ?? '삭제에 실패했습니다')
      return
    }
    clearSelection()
    router.refresh()
  }, [count, selected, clearSelection, router])

  const allSelected = filteredItems.length > 0 && filteredItems.every(i => selected.has(i.id))

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="품목명·QR 코드·위치 검색"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
      />
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              onClick={allSelected ? clearSelection : selectAll}
              className="font-medium text-blue-600 hover:underline"
            >
              {allSelected ? '전체 해제' : '전체 선택'}
            </button>
            <span className="text-slate-500">·</span>
            <span className="text-slate-600">
              선택 <strong className="text-slate-900">{count}</strong>개
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-600">
              표시 <strong className="text-slate-900">{filteredItems.length}</strong>개
            </span>
          </div>
          <button
            type="button"
            disabled={count === 0 || busy}
            onClick={() => void onDeleteSelected()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            선택 삭제
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {filteredItems.map(item => {
          const isOn = selected.has(item.id)
          return (
            <li key={item.id} className="flex gap-2 items-stretch">
              <label className="flex items-center justify-center w-11 shrink-0 rounded-2xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-400">
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(item.id)}
                  className="rounded border-slate-300 w-4 h-4"
                  aria-label={`${item.name} 선택`}
                />
              </label>
              <Link
                href={`/items/${item.id}`}
                className="flex flex-1 min-w-0 items-center justify-between gap-3 rounded-2xl bg-white border border-slate-200 p-4 shadow-sm active:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{item.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    등록 {new Date(item.created_at).toLocaleDateString('ko-KR')}
                    {item.barcode_code ? ` · QR ${item.barcode_code}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-lg font-semibold text-blue-600 tabular-nums">{item.quantity}</span>
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      {filteredItems.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
          검색 결과가 없습니다.
        </p>
      )}
    </div>
  )
}
