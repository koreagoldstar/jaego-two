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
  const barcodeCandidates = unique([
    code,
    safeCode,
    code.toUpperCase(),
    safeCode.toUpperCase(),
    stripUnitSuffix(code),
    stripUnitSuffix(safeCode),
  ])

  for (const candidate of barcodeCandidates) {
    const { data: byBarcode } = await base().eq('barcode_code', candidate).maybeSingle()
    if (byBarcode?.id) return byBarcode.id
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
