import { createClient } from '@/lib/supabase/server'
import { excelErrorResponse, excelFileResponse } from '@/lib/excel/response'
import { buildCompletedProjectSet } from '@/lib/projects/projectStatus'
import type { ProjectStatusRow } from '@/lib/projects/projectStatus'
import { fetchAllPaged } from '@/lib/supabase/fetchAll'
import { buildStockOverview, type PlanSumRow, type ShippedTxRow } from '@/lib/stockOverview'
import type { Item } from '@/lib/supabase/types'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const type = request.nextUrl.searchParams.get('type') ?? 'items'
    const selectedProject = (request.nextUrl.searchParams.get('project') ?? '').trim()

    const [itemsRes, plansRes, txRes, statusRes] = await Promise.all([
      supabase.from('items').select('id, name, quantity, sh').eq('user_id', user.id).order('name'),
      supabase
        .from('project_usage_plans')
        .select('project_name, install_date, item_id, planned_qty')
        .eq('user_id', user.id),
      fetchAllPaged(async (from, to) =>
        supabase
          .from('stock_transactions')
          .select('project, item_id, direction, amount')
          .eq('user_id', user.id)
          .not('project', 'is', null)
          .neq('project', '')
          .order('created_at', { ascending: true })
          .range(from, to),
      ),
      supabase.from('project_status').select('project_name, completed_at').eq('user_id', user.id),
    ])

    if (itemsRes.error) return excelErrorResponse(`품목 조회 실패: ${itemsRes.error.message}`)
    if (plansRes.error) return excelErrorResponse(`사용예정 조회 실패: ${plansRes.error.message}`)
    if (txRes.error) return excelErrorResponse(`입출고 조회 실패: ${txRes.error}`)

    const items = (itemsRes.data ?? []) as Item[]
    const plans = (plansRes.data ?? []) as PlanSumRow[]
    const transactions = txRes.data as ShippedTxRow[]
    const completedProjects = buildCompletedProjectSet((statusRes.data ?? []) as ProjectStatusRow[])
    const overview = buildStockOverview(items, plans, selectedProject, transactions, completedProjects)

    const wb = XLSX.utils.book_new()

    if (type === 'matrix') {
      const headers = [
        '품목',
        'SH',
        '현재재고',
        ...overview.projectColumns.map(c => `${c.project} 잔여 (설치: ${c.installDate || '미정'})`),
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
      const headers = ['품목', 'SH', '현재재고', '사용예정(잔)', '잔여수량']
      const aoa = [
        headers,
        ...overview.rows.map(r => [r.name, r.sh, r.currentQty, r.plannedQty, r.remainQty]),
        ['합계', '', overview.totalCurrent, overview.totalPlanned, overview.totalRemain],
      ]
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      XLSX.utils.book_append_sheet(wb, ws, '품목요약')
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const filename = type === 'matrix' ? 'jaego-stock-projects.xlsx' : 'jaego-stock-items.xlsx'
    return excelFileResponse(buf, filename)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '엑셀 생성 중 오류'
    return excelErrorResponse(msg)
  }
}
