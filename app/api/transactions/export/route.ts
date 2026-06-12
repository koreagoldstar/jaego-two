import { createClient } from '@/lib/supabase/server'
import {
  buildByItemWorkbook,
  buildExportLines,
  buildSingleSheetWorkbook,
  sanitizeFilenamePart,
} from '@/lib/transactions/exportExcel'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function excelResponse(buf: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': XLSX_TYPE,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const mode = request.nextUrl.searchParams.get('mode') ?? 'all'
  const itemId = request.nextUrl.searchParams.get('itemId')?.trim() ?? ''

  if (mode === 'by-item') {
    const buf = await buildByItemWorkbook(supabase, user.id)
    return excelResponse(buf, 'jaego-transactions-by-item.xlsx')
  }

  if (itemId) {
    const { data: item } = await supabase
      .from('items')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('id', itemId)
      .maybeSingle()

    if (!item) return new NextResponse('Not found', { status: 404 })

    const lines = await buildExportLines(supabase, user.id, {
      itemId: item.id,
      itemName: item.name,
    })
    const buf = buildSingleSheetWorkbook(lines, item.name)
    return excelResponse(buf, `jaego-transactions-${sanitizeFilenamePart(item.name)}.xlsx`)
  }

  const lines = await buildExportLines(supabase, user.id)
  const buf = buildSingleSheetWorkbook(lines, '입출고이력')
  return excelResponse(buf, 'jaego-transactions.xlsx')
}
