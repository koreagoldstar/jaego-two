'use client'

import { TransactionsHistoryClient } from '@/components/transactions/TransactionsHistoryClient'
import {
  mapInventoryEventsToHistoryRows,
  mapStockTransactionsToHistoryRows,
  mergeHistoryRows,
} from '@/lib/transactions/mapHistoryRows'
import { createClient } from '@/lib/supabase/client'
import { Download, Loader2, Package, Search } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

export type ItemOption = {
  id: string
  name: string
  barcode_code: string | null
  quantity: number
}

type Props = {
  items: ItemOption[]
  projectOptions: string[]
  initialItemId?: string
}

function matchesQuery(item: ItemOption, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const name = item.name.toLowerCase()
  const code = (item.barcode_code ?? '').toLowerCase()
  return name.includes(q) || code.includes(q)
}

export function ItemTransactionsClient({ items, projectOptions, initialItemId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialItemId ?? '')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [historyKey, setHistoryKey] = useState(0)
  const [historyRows, setHistoryRows] = useState<ReturnType<typeof mergeHistoryRows>>([])

  const filtered = useMemo(() => {
    const matched = items.filter(item => matchesQuery(item, query))
    return matched.sort((a, b) => a.name.localeCompare(b.name, 'ko')).slice(0, 30)
  }, [items, query])

  const selected = useMemo(() => items.find(i => i.id === selectedId) ?? null, [items, selectedId])

  const loadHistory = useCallback(async (itemId: string) => {
    if (!itemId) {
      setHistoryRows([])
      return
    }
    setLoading(true)
    setLoadError(null)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      setLoadError('로그인이 필요합니다')
      return
    }

    const item = items.find(i => i.id === itemId)
    const [txRes, evRes] = await Promise.all([
      supabase
        .from('stock_transactions')
        .select('id, direction, amount, note, project, lot_code, created_at, items(name, barcode_code)')
        .eq('user_id', user.id)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(500),
      item
        ? supabase
            .from('inventory_events')
            .select('id, event_type, item_name, quantity, detail, created_at')
            .eq('user_id', user.id)
            .eq('item_name', item.name)
            .order('created_at', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [], error: null }),
    ])

    setLoading(false)
    if (txRes.error) {
      setLoadError(txRes.error.message)
      setHistoryRows([])
      return
    }

    const stockRows = mapStockTransactionsToHistoryRows((txRes.data ?? []) as unknown as Parameters<typeof mapStockTransactionsToHistoryRows>[0])
    const invRows = evRes.error
      ? []
      : mapInventoryEventsToHistoryRows((evRes.data ?? []) as unknown as Parameters<typeof mapInventoryEventsToHistoryRows>[0])
    setHistoryRows(mergeHistoryRows(stockRows, invRows))
    setHistoryKey(k => k + 1)
  }, [items])

  useEffect(() => {
    if (selectedId) void loadHistory(selectedId)
    else setHistoryRows([])
  }, [selectedId, loadHistory])

  const selectItem = (itemId: string) => {
    setSelectedId(itemId)
    const params = new URLSearchParams(searchParams.toString())
    if (itemId) params.set('item', itemId)
    else params.delete('item')
    const qs = params.toString()
    router.replace(qs ? `/transactions/by-item?${qs}` : '/transactions/by-item', { scroll: false })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
        <label className="block text-sm font-medium text-slate-700">제품 검색</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="품목명 또는 QR 코드로 검색"
            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm"
            autoComplete="off"
          />
        </div>
        <p className="text-xs text-slate-500">검색 결과에서 품목을 선택하면 입·출고 이력이 표시됩니다.</p>

        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">검색 결과가 없습니다.</p>
        ) : (
          <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
            {filtered.map(item => {
              const active = item.id === selectedId
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => selectItem(item.id)}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 ${
                      active ? 'bg-blue-50 text-blue-900' : 'text-slate-800'
                    }`}
                  >
                    <p className="font-medium truncate">{item.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      재고 {item.quantity}
                      {item.barcode_code ? ` · ${item.barcode_code}` : ''}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {selected ? (
        <div className="rounded-2xl bg-slate-900 text-white p-4 shadow-md space-y-3">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-slate-400 uppercase tracking-wide">선택된 제품</p>
              <p className="text-lg font-bold truncate">{selected.name}</p>
              <p className="text-sm text-slate-300 mt-1">
                현재 재고 {selected.quantity}
                {selected.barcode_code ? ` · ${selected.barcode_code}` : ''}
              </p>
            </div>
          </div>
          <a
            href={`/api/transactions/export?itemId=${encodeURIComponent(selected.id)}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 px-3 py-2 text-sm text-white"
          >
            <Download className="w-4 h-4" />
            이 제품 이력 엑셀 다운로드
          </a>
        </div>
      ) : (
        <p className="text-sm text-slate-500 rounded-2xl border border-dashed border-slate-300 p-6 text-center bg-white">
          위에서 제품을 검색해 선택하세요.
        </p>
      )}

      {loading && (
        <div className="flex justify-center py-8 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {loadError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{loadError}</p>
      )}

      {!loading && selected && historyRows.length === 0 && !loadError && (
        <p className="text-sm text-slate-500 rounded-2xl border border-dashed border-slate-300 p-6 text-center bg-white">
          이 제품의 입출고 이력이 없습니다.
        </p>
      )}

      {!loading && historyRows.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            입출고 내역 <span className="text-sm font-normal text-slate-500">({historyRows.length}건)</span>
          </h2>
          <TransactionsHistoryClient
            key={`${selectedId}-${historyKey}`}
            rows={historyRows}
            projectOptions={projectOptions}
            groupBy="flat"
            onHistoryMutated={() => void loadHistory(selectedId)}
          />
        </section>
      )}
    </div>
  )
}
