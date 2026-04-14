import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeBarcodePayload, to1DBarcodeSafeString } from '@/lib/items/barcodePayload'

function stripUnitSuffix(code: string): string {
  return code.replace(/-(\d{3})$/, '')
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(v => v.trim()).filter(Boolean)))
}

/** 사용자 품목 중 스캔 문자열로 id 조회 (인쇄 라벨 payload와 동일 규칙에 맞춤) */
export async function findItemIdByBarcode(
  supabase: SupabaseClient,
  userId: string,
  rawCode: string
): Promise<string | null> {
  const code = normalizeBarcodePayload(rawCode)
  if (!code) return null

  const base = () =>
    supabase.from('items').select('id').eq('user_id', userId)

  const safeCode = to1DBarcodeSafeString(code)
  const barcodeCandidates = unique([code, safeCode, code.toUpperCase(), safeCode.toUpperCase(), stripUnitSuffix(code)])
  const serialCandidates = unique([code, safeCode, code.toUpperCase(), stripUnitSuffix(code), stripUnitSuffix(safeCode)])
  const shCandidates = unique([code, safeCode, code.toUpperCase(), stripUnitSuffix(code), stripUnitSuffix(safeCode)])

  for (const candidate of barcodeCandidates) {
    const { data: byBarcode } = await base().eq('barcode_code', candidate).maybeSingle()
    if (byBarcode?.id) return byBarcode.id
  }

  for (const candidate of serialCandidates) {
    const { data: bySerial } = await base().eq('serial_number', candidate).maybeSingle()
    if (bySerial?.id) return bySerial.id
  }

  for (const candidate of shCandidates) {
    const { data: byShRows } = await base().eq('sh', candidate).limit(1)
    const bySh = byShRows?.[0]
    if (bySh?.id) return bySh.id
  }

  /* sh+구분자+serial 복합 (라벨 설정과 동일하게 인쇄된 경우) */
  for (const sep of ['|', '/', ':'] as const) {
    const idx = code.indexOf(sep)
    if (idx <= 0) continue
    const left = code.slice(0, idx).trim()
    const right = code.slice(idx + 1).trim()
    if (!left || !right) continue
    const leftCandidates = unique([left, left.toUpperCase(), stripUnitSuffix(left)])
    const rightCandidates = unique([right, right.toUpperCase(), stripUnitSuffix(right)])
    for (const lc of leftCandidates) {
      for (const rc of rightCandidates) {
        const { data: comp } = await base().eq('sh', lc).eq('serial_number', rc).maybeSingle()
        if (comp?.id) return comp.id
      }
    }
  }

  /* 부분 일치는 와일드카드 문자가 섞이면 쿼리가 깨질 수 있어 제한 */
  if (code.length >= 2 && !/[%_]/.test(code)) {
    const { data: loose } = await supabase
      .from('items')
      .select('id')
      .eq('user_id', userId)
      .ilike('barcode_code', `%${code}%`)
      .limit(1)
      .maybeSingle()

    if (loose?.id) return loose.id
  }

  return null
}
