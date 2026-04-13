import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AlertTriangle, Layers, Plus } from 'lucide-react'
import type { Item } from '@/lib/supabase/types'
import { ItemsListClient } from '@/components/items/ItemsListClient'

export const dynamic = 'force-dynamic'

export default async function ItemsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: rows } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  const items = (rows ?? []) as Item[]
  const lowStock = items
    .filter(item => (item.quantity ?? 0) <= 5)
    .sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">품목</h1>
          <p className="text-sm text-slate-500">BoxHero 스타일 목록</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Link
            href="/items/new?mode=bulk"
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-medium px-3 py-2.5 shadow-sm hover:bg-slate-50"
          >
            <Layers className="w-4 h-4" />
            여러 개 추가
          </Link>
          <Link
            href="/items/new"
            className="inline-flex items-center gap-1 rounded-xl bg-blue-600 text-white text-sm font-medium px-4 py-2.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            추가
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 text-sm">
          등록된 품목이 없습니다. <Link className="text-blue-600 font-medium" href="/items/new">품목 추가</Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <ItemsListClient items={items} />
          </div>
          <aside className="md:col-span-1 rounded-2xl border border-amber-200 bg-amber-50 p-4 h-fit">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <p className="text-sm font-semibold text-amber-800">재고 부족 경고 (5개 이하)</p>
            </div>
            {lowStock.length === 0 ? (
              <p className="text-sm text-emerald-700 mt-3">모든 품목 재고가 6개 이상입니다.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {lowStock.map(item => (
                  <li key={item.id} className="rounded-lg bg-white border border-amber-100 px-2.5 py-2 text-sm flex justify-between">
                    <span className="truncate pr-2">{item.name}</span>
                    <strong className="tabular-nums text-amber-700">{item.quantity}</strong>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
