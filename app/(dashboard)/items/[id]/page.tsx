import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Item } from '@/lib/supabase/types'
import { buildItemLabelVariants } from '@/lib/items/labelVariants'
import { Pencil } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ItemDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: row } = await supabase
    .from('items')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!row) notFound()
  const item = row as Item
  const labelRows = buildItemLabelVariants(item, '|')

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center justify-between gap-2">
        <Link href="/items" className="text-sm text-blue-600">
          ← 목록
        </Link>
        <Link
          href={`/items/${item.id}/edit`}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600"
        >
          <Pencil className="w-4 h-4" />
          수정
        </Link>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-3">
        <h1 className="text-xl font-bold text-slate-900">{item.name}</h1>
        <dl className="text-sm space-y-2">
          <Row label="수량" value={<span className="text-2xl font-semibold text-blue-600">{item.quantity}</span>} />
          {item.sh && <Row label="SH" value={item.sh} />}
          {item.barcode_code && <Row label="바코드" value={item.barcode_code} />}
          {item.serial_number && <Row label="시리얼" value={item.serial_number} />}
          {item.location && <Row label="위치" value={item.location} />}
          {item.description && <Row label="메모" value={item.description} />}
        </dl>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">재고 수량 기준 라벨</h2>
          <span className="text-xs text-slate-500">{labelRows.length}개</span>
        </div>
        {labelRows.length === 0 ? (
          <p className="text-sm text-slate-500">현재 재고가 0개라 라벨이 없습니다.</p>
        ) : (
          <ul className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
            {labelRows.map(row => (
              <li key={`${item.id}-${row.index}`} className="px-3 py-2 text-xs text-slate-700 space-y-1">
                <p className="font-medium text-slate-900">#{row.index}</p>
                {row.barcode && <p>바코드: {row.barcode}</p>}
                {row.serial && <p>시리얼: {row.serial}</p>}
                {row.payload && <p className="text-slate-500 break-all">인쇄값: {row.payload}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href={`/move?item=${item.id}`}
        className="block w-full text-center rounded-xl bg-blue-600 text-white font-medium py-3 shadow-sm"
      >
        입·출고 하기
      </Link>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2 last:border-0">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className="text-slate-900 text-right break-all">{value}</dd>
    </div>
  )
}
