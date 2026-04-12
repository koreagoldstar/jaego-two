import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Plus, ChevronRight } from 'lucide-react'
import type { Item } from '@/lib/supabase/types'

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">품목</h1>
          <p className="text-sm text-slate-500">BoxHero 스타일 목록</p>
        </div>
        <Link
          href="/items/new"
          className="inline-flex items-center gap-1 rounded-xl bg-blue-600 text-white text-sm font-medium px-4 py-2.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          추가
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 text-sm">
          등록된 품목이 없습니다. <Link className="text-blue-600 font-medium" href="/items/new">품목 추가</Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map(item => (
            <li key={item.id}>
              <Link
                href={`/items/${item.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white border border-slate-200 p-4 shadow-sm active:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{item.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {item.sku ? `SKU ${item.sku}` : ''}
                    {item.barcode_code ? ` · ${item.barcode_code}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-lg font-semibold text-blue-600 tabular-nums">{item.quantity}</span>
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
