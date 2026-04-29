import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Item, ItemStockLot } from '@/lib/supabase/types'
import { buildItemLabelVariants } from '@/lib/items/labelVariants'
import { ItemLabelStockListClient } from '@/components/items/ItemLabelStockListClient'
import { ItemStockLegacyClient } from '@/components/items/ItemStockLegacyClient'
import { ItemStockLotsClient } from '@/components/items/ItemStockLotsClient'
import { ItemStockReconcileClient } from '@/components/items/ItemStockReconcileClient'
import { isMissingItemStockLotsTable } from '@/lib/supabase/missingTable'
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

  const { data: lotRows, error: lotsErr } = await supabase
    .from('item_stock_lots')
    .select('id, user_id, item_id, quantity, lot_code, note, created_at')
    .eq('item_id', params.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const lotsTableMissing = Boolean(lotsErr && isMissingItemStockLotsTable(lotsErr))
  const lotsLoadError = lotsErr && !lotsTableMissing ? lotsErr.message : null
  const lots = (lotsTableMissing ? [] : (lotRows ?? [])) as ItemStockLot[]
  const lotCodes = lots.map(l => (l.lot_code ?? '').trim()).filter(Boolean)

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
          <Row
            label="품목 등록일"
            value={new Date(item.created_at).toLocaleString('ko-KR')}
          />
          {item.barcode_code && <Row label="QR 스캔 코드" value={item.barcode_code} />}
          {item.location && <Row label="위치" value={item.location} />}
          {item.description && <Row label="메모" value={item.description} />}
        </dl>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">재고 수량</h2>
          <span className="text-xs text-slate-500">합계 {item.quantity}개</span>
        </div>
        {lotsLoadError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">{lotsLoadError}</p>
        )}
        {lotsTableMissing ? (
          <ItemStockLegacyClient itemId={item.id} quantity={item.quantity} />
        ) : (
          <ItemStockLotsClient itemId={item.id} lots={lots} />
        )}
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">재고 수량 기준 라벨</h2>
          <span className="text-xs text-slate-500">{labelRows.length}개</span>
        </div>
        {labelRows.length === 0 ? (
          <p className="text-sm text-slate-500">현재 재고가 0개라 라벨이 없습니다.</p>
        ) : (
          <ItemLabelStockListClient
            itemId={item.id}
            labelRows={labelRows}
            legacyStockMode={lotsTableMissing}
          />
        )}
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">재고 대사 모드</h2>
        {lotsTableMissing ? (
          <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            입고 단위 테이블(item_stock_lots)을 찾을 수 없어 재고 대사 모드를 사용할 수 없습니다. 마이그레이션(007·009)을
            적용한 뒤 다시 확인해 주세요.
          </p>
        ) : (
          <ItemStockReconcileClient itemId={item.id} currentCodes={lotCodes} />
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
