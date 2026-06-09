/** 한국(Asia/Seoul) 기준 오늘 00:00 ~ 23:59:59.999 ISO 범위 */
export function kstTodayRangeIso(now = new Date()): { start: string; end: string; label: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const y = parts.find(p => p.type === 'year')?.value ?? '1970'
  const m = parts.find(p => p.type === 'month')?.value ?? '01'
  const d = parts.find(p => p.type === 'day')?.value ?? '01'
  const label = `${y}-${m}-${d}`
  return {
    label,
    start: `${label}T00:00:00.000+09:00`,
    end: `${label}T23:59:59.999+09:00`,
  }
}
