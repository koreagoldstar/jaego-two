import { createClient } from '@/lib/supabase/server'
import { isMissingTableError } from '@/lib/supabase/missingTable'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const TABLE_KEYS = [
  'items',
  'stock_transactions',
  'inventory_events',
  'item_stock_lots',
  'project_usage_plans',
] as const

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const uid = user.id

  const [
    itemsRes,
    stockTxRes,
    invEventsRes,
    lotsRes,
    plansRes,
  ] = await Promise.all([
    supabase.from('items').select('*').eq('user_id', uid),
    supabase.from('stock_transactions').select('*').eq('user_id', uid),
    supabase.from('inventory_events').select('*').eq('user_id', uid),
    supabase.from('item_stock_lots').select('*').eq('user_id', uid),
    supabase.from('project_usage_plans').select('*').eq('user_id', uid),
  ])

  const responses = [itemsRes, stockTxRes, invEventsRes, lotsRes, plansRes]
  const missingTables: string[] = []
  let fatalError: string | null = null

  const rowData: Record<(typeof TABLE_KEYS)[number], unknown[]> = {
    items: [],
    stock_transactions: [],
    inventory_events: [],
    item_stock_lots: [],
    project_usage_plans: [],
  }

  TABLE_KEYS.forEach((key, i) => {
    const res = responses[i]
    if (!res.error) {
      rowData[key] = res.data ?? []
      return
    }
    if (isMissingTableError(res.error)) {
      missingTables.push(key)
      rowData[key] = []
      return
    }
    fatalError = res.error.message ?? 'Backup query failed'
  })

  if (fatalError) {
    return NextResponse.json({ error: fatalError }, { status: 500 })
  }

  const payload: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    app: 'jaego-two',
    items: rowData.items,
    stock_transactions: rowData.stock_transactions,
    inventory_events: rowData.inventory_events,
    item_stock_lots: rowData.item_stock_lots,
    project_usage_plans: rowData.project_usage_plans,
  }

  if (missingTables.length > 0) {
    payload.missingTables = missingTables
    payload.note =
      '일부 테이블이 DB에 없어 빈 배열로 포함되었습니다. supabase/migrations 의 SQL을 Supabase에서 실행하면 채워집니다.'
  }

  const dateStr = new Date().toISOString().slice(0, 10)
  const body = JSON.stringify(payload, null, 2)

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="jaego-two-backup-${dateStr}.json"`,
    },
  })
}
