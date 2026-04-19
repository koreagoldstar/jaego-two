import { createClient } from '@/lib/supabase/server'
import { buildStockOverview, type PlanSumRow } from '@/lib/stockOverview'
import type { Item } from '@/lib/supabase/types'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const type = request.nextUrl.searchParams.get('type') ?? 'items'
  const selectedProject = (request.nextUrl.searchParams.get('project') ?? '').trim()

  const [itemsRes, plansRes] = await Promise.all([
    supabase.from('items').select('id, name, quantity, sh').eq('user_id', user.id).order('name'),
    supabase
      .from('project_usage_plans')
      .select('project_name, install_date, item_id, planned_qty')
      .eq('user_id', user.id),
  ])

  const items = (itemsRes.data ?? []) as Item[]
  const plans = (plansRes.data ?? []) as PlanSumRow[]
  const overview = buildStockOverview(items, plans, selectedProject)

  const wb = XLSX.utils.book_new()

  if (type === 'matrix') {
    const headers = [
      '품목',
      'SH',
      '현재재고',
      ...overview.projectColumns.map(c => `${c.project} (설치: ${c.installDate || '미정'})`),
      '잔여수량',
    ]
    const dataRows = overview.itemProjectRows.map(row => [
      row.name,
      row.sh,
      row.currentQty,
      ...overview.projectColumns.map(c => row.byProject.get(c.project) ?? 0),
      row.remainQty,
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
    XLSX.utils.book_append_sheet(wb, ws, '프로젝트전체요약')
  } else {
    const headers = ['품목', 'SH', '현재재고', '사용예정', '잔여수량']
    const aoa = [
      headers,
      ...overview.rows.map(r => [r.name, r.sh, r.currentQty, r.plannedQty, r.remainQty]),
      ['합계', '', overview.totalCurrent, overview.totalPlanned, overview.totalRemain],
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wb, ws, '품목요약')
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = type === 'matrix' ? 'jaego-stock-projects.xlsx' : 'jaego-stock-items.xlsx'

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
