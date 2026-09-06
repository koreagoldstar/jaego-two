import { NextResponse } from 'next/server'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** NextResponse가 Node Buffer를 불안정하게 다루는 경우가 있어 순수 Uint8Array로 통일 */
export function excelFileResponse(buf: Buffer | Uint8Array, filename: string) {
  const body = new Uint8Array(buf)
  return new NextResponse(body, {
    headers: {
      'Content-Type': XLSX_TYPE,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export function excelErrorResponse(message: string, status = 500) {
  return new NextResponse(message.slice(0, 800), {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
