import { createClient } from '@/lib/supabase/server'
import { excelErrorResponse, excelFileResponse } from '@/lib/excel/response'
import {
  buildByItemWorkbook,
  buildExportLines,
  buildSingleSheetWorkbook,
  sanitizeFilenamePart,
} from '@/lib/transactions/exportExcel'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const mode = request.nextUrl.searchParams.get('mode') ?? 'all'
    const itemId = request.nextUrl.searchParams.get('itemId')?.trim() ?? ''
    const project = request.nextUrl.searchParams.get('project')?.trim() ?? ''

    if (mode === 'by-item') {
      const buf = await buildByItemWorkbook(supabase, user.id)
      return excelFileResponse(buf, 'jaego-transactions-by-item.xlsx')
    }

    if (itemId) {
      const { data: item, error } = await supabase
        .from('items')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('id', itemId)
        .maybeSingle()

      if (error) return excelErrorResponse(`품목 조회 실패: ${error.message}`)
      if (!item) return new NextResponse('Not found', { status: 404 })

      const lines = await buildExportLines(supabase, user.id, {
        itemId: item.id,
        itemName: item.name,
      })
      const buf = buildSingleSheetWorkbook(lines, item.name)
      return excelFileResponse(buf, `jaego-transactions-${sanitizeFilenamePart(item.name)}.xlsx`)
    }

    if (project) {
      const lines = await buildExportLines(supabase, user.id, { project })
      const buf = buildSingleSheetWorkbook(lines, project)
      return excelFileResponse(buf, `jaego-transactions-${sanitizeFilenamePart(project)}.xlsx`)
    }

    const lines = await buildExportLines(supabase, user.id)
    const buf = buildSingleSheetWorkbook(lines, '입출고이력')
    return excelFileResponse(buf, 'jaego-transactions.xlsx')
  } catch (e) {
    const msg = e instanceof Error ? e.message : '엑셀 생성 중 오류'
    return excelErrorResponse(msg)
  }
}
