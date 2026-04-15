import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const uid = user.id

  const [items, stock_transactions, inventory_events, item_stock_lots, project_usage_plans] =
    await Promise.all([
      supabase.from('items').select('*').eq('user_id', uid),
      supabase.from('stock_transactions').select('*').eq('user_id', uid),
      supabase.from('inventory_events').select('*').eq('user_id', uid),
      supabase.from('item_stock_lots').select('*').eq('user_id', uid),
      supabase.from('project_usage_plans').select('*').eq('user_id', uid),
    ])

  const errs = [
    items.error,
    stock_transactions.error,
    inventory_events.error,
    item_stock_lots.error,
    project_usage_plans.error,
  ].filter(Boolean)

  if (errs.length > 0) {
    const msg = errs.map(e => e?.message).join('; ')
    return NextResponse.json({ error: msg || 'Backup query failed' }, { status: 500 })
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    app: 'jaego-two',
    items: items.data ?? [],
    stock_transactions: stock_transactions.data ?? [],
    inventory_events: inventory_events.data ?? [],
    item_stock_lots: item_stock_lots.data ?? [],
    project_usage_plans: project_usage_plans.data ?? [],
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
