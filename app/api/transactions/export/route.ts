import { createClient } from '@/lib/supabase/server'
import type { StockTransaction } from '@/lib/supabase/types'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

const LIMIT = 5000

type TxRow = StockTransaction & {
  items: { name: string; barcode_code: string | null } | null
}

type InventoryEventRow = {
  id: string
  event_type: 'item_create' | 'item_delete'
  item_name: string
  quantity: number
  detail: string | null
  created_at: string
}

type ExportLine = {
  created_at: string
  category: string
  itemName: string
  qtySigned: number
  project: string
  note: string
  qr: string
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: rows } = await supabase
    .from('stock_transactions')
    .select('id, direction, amount, note, project, created_at, items(name, barcode_code)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(LIMIT)

  const list = (rows ?? []) as unknown as TxRow[]

  const { data: eventRows, error: eventError } = await supabase
    .from('inventory_events')
    .select('id, event_type, item_name, quantity, detail, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(LIMIT)

  const inventoryEvents = eventError ? [] : ((eventRows ?? []) as InventoryEventRow[])

  const lines: ExportLine[] = [
    ...list.map(tx => ({
      created_at: tx.created_at,
      category: tx.direction === 'in' ? '입고' : '출고',
      itemName: tx.items?.name ?? '품목',
      qtySigned: tx.direction === 'in' ? tx.amount : -tx.amount,
      project: tx.project ?? '',
      note: tx.note ?? '',
      qr: tx.items?.barcode_code ?? '',
    })),
    ...inventoryEvents.map(ev => ({
      created_at: ev.created_at,
      category: ev.event_type === 'item_create' ? '품목 등록' : '품목 삭제',
      itemName: ev.item_name,
      qtySigned: ev.event_type === 'item_create' ? ev.quantity : -ev.quantity,
      project: '',
      note: ev.detail ?? '',
      qr: '',
    })),
  ]

  lines.sort((a, b) => b.created_at.localeCompare(a.created_at))

  const headers = ['일시', '구분', '품목', '변동수량', '프로젝트·현장', '메모', 'QR코드']
  const aoa = [
    headers,
    ...lines.map(l => [
      new Date(l.created_at).toLocaleString('ko-KR'),
      l.category,
      l.itemName,
      l.qtySigned,
      l.project,
      l.note,
      l.qr,
    ]),
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  XLSX.utils.book_append_sheet(wb, ws, '입출고이력')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="jaego-transactions.xlsx"',
    },
  })
}
