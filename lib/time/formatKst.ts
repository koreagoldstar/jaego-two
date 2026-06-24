/** 서버·클라이언트 공통 — 한국 시간(Asia/Seoul)으로 표시 */
export function formatKstDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}
