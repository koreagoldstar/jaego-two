import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function csvEscape(value: unknown) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toCsv(headers: string[], rows: Array<Array<unknown>>) {
  const lines = [headers.map(csvEscape).join(',')]
  for (const row of rows) lines.push(row.map(csvEscape).join(','))
  return `\uFEFF${lines.join('\n')}`
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') ?? 'plans'
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  if (type === 'history') {
    const [{ data: txRows }, { data: itemRows }, { data: planRows }] = await Promise.all([
      supabase
        .from('stock_transactions')
        .select('created_at, project, item_id, direction, amount')
        .eq('user_id', user.id)
        .eq('direction', 'out')
        .not('project', 'is', null)
        .neq('project', '')
        .order('created_at', { ascending: false }),
      supabase.from('items').select('id, name').eq('user_id', user.id),
      supabase.from('project_usage_plans').select('project_name, install_date').eq('user_id', user.id),
    ])

    const itemById = new Map((itemRows ?? []).map(r => [r.id, r.name] as const))
    const installByProject = new Map<string, string>()
    for (const row of planRows ?? []) {
      const project = (row as { project_name?: string }).project_name ?? ''
      const date = (row as { install_date?: string | null }).install_date ?? ''
      if (project && date && !installByProject.has(project)) installByProject.set(project, date)
    }

    const csv = toCsv(
      ['출고일시', '설치일자', '프로젝트', '품목', '수량'],
      (txRows ?? []).map(r => [
        new Date(r.created_at).toLocaleString('ko-KR'),
        installByProject.get((r.project ?? '').trim()) ?? '',
        r.project ?? '',
        itemById.get(r.item_id) ?? '품목',
        r.amount ?? 0,
      ])
    )
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="project-out-history.csv"`,
      },
    })
  }

  const [{ data: planRows }, { data: itemRows }] = await Promise.all([
    supabase
      .from('project_usage_plans')
      .select('project_name, install_date, item_id, planned_qty')
      .eq('user_id', user.id)
      .order('project_name'),
    supabase.from('items').select('id, name, quantity').eq('user_id', user.id),
  ])
  const itemById = new Map((itemRows ?? []).map(r => [r.id, r] as const))

  const csv = toCsv(
    ['프로젝트', '설치일자', '품목', '현재재고', '사용예정'],
    (planRows ?? []).map(r => {
      const item = itemById.get(r.item_id)
      return [
        r.project_name ?? '',
        r.install_date ?? '',
        item?.name ?? '품목',
        item?.quantity ?? 0,
        r.planned_qty ?? 0,
      ]
    })
  )
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="project-plans.csv"`,
    },
  })
}
