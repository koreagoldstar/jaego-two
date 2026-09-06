import { createClient } from '@/lib/supabase/server'
import { excelErrorResponse, excelFileResponse } from '@/lib/excel/response'
import { fetchAllPaged } from '@/lib/supabase/fetchAll'
import { formatKstDateTime } from '@/lib/time/formatKst'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type') ?? 'plans'
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const wb = XLSX.utils.book_new()

    if (type === 'history') {
      const [txRes, itemsRes, planRes] = await Promise.all([
        fetchAllPaged(async (from, to) =>
          supabase
            .from('stock_transactions')
            .select('created_at, project, item_id, direction, amount')
            .eq('user_id', user.id)
            .eq('direction', 'out')
            .not('project', 'is', null)
            .neq('project', '')
            .order('created_at', { ascending: false })
            .range(from, to),
        ),
        supabase.from('items').select('id, name').eq('user_id', user.id),
        supabase.from('project_usage_plans').select('project_name, install_date').eq('user_id', user.id),
      ])

      if (txRes.error) return excelErrorResponse(`출고 이력 조회 실패: ${txRes.error}`)
      if (itemsRes.error) return excelErrorResponse(`품목 조회 실패: ${itemsRes.error.message}`)
      if (planRes.error) return excelErrorResponse(`프로젝트 조회 실패: ${planRes.error.message}`)

      const itemById = new Map((itemsRes.data ?? []).map(r => [r.id, r.name] as const))
      const installByProject = new Map<string, string>()
      for (const row of planRes.data ?? []) {
        const project = (row as { project_name?: string }).project_name ?? ''
        const date = (row as { install_date?: string | null }).install_date ?? ''
        if (project && date && !installByProject.has(project)) installByProject.set(project, date)
      }

      const headers = ['출고일시', '설치일자', '프로젝트', '품목', '수량']
      const aoa = [
        headers,
        ...txRes.data.map(r => [
          formatKstDateTime(r.created_at),
          installByProject.get((r.project ?? '').trim()) ?? '',
          r.project ?? '',
          itemById.get(r.item_id) ?? '품목',
          r.amount ?? 0,
        ]),
      ]
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      XLSX.utils.book_append_sheet(wb, ws, '프로젝트출고이력')
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
      return excelFileResponse(buf, 'jaego-project-out-history.xlsx')
    }

    const [planRes, itemsRes, statusRes] = await Promise.all([
      supabase
        .from('project_usage_plans')
        .select('project_name, install_date, item_id, planned_qty')
        .eq('user_id', user.id)
        .order('project_name'),
      supabase.from('items').select('id, name, quantity').eq('user_id', user.id),
      supabase.from('project_status').select('project_name').eq('user_id', user.id),
    ])

    if (planRes.error) return excelErrorResponse(`사용예정 조회 실패: ${planRes.error.message}`)
    if (itemsRes.error) return excelErrorResponse(`품목 조회 실패: ${itemsRes.error.message}`)

    const completed = new Set(
      (statusRes.data ?? []).map(r => (r.project_name ?? '').trim()).filter(Boolean),
    )
    const activePlans = (planRes.data ?? []).filter(r => !completed.has((r.project_name ?? '').trim()))
    const itemById = new Map((itemsRes.data ?? []).map(r => [r.id, r] as const))

    const headers = ['프로젝트', '설치일자', '품목', '현재재고', '사용예정']
    const aoa = [
      headers,
      ...activePlans.map(r => {
        const item = itemById.get(r.item_id)
        return [
          r.project_name ?? '',
          r.install_date ?? '',
          item?.name ?? '품목',
          item?.quantity ?? 0,
          r.planned_qty ?? 0,
        ]
      }),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wb, ws, '사용예정재고')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    return excelFileResponse(buf, 'jaego-project-plans.xlsx')
  } catch (e) {
    const msg = e instanceof Error ? e.message : '엑셀 생성 중 오류'
    return excelErrorResponse(msg)
  }
}
