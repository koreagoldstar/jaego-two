/** 문서·초기 설정용 권장 비밀번호. 실제 로그인은 입력값을 Supabase Users 비밀번호와 맞춥니다. */
export const KIOSK_PIN = '159311'
export const defaultKioskEmail = 'broadstock-kiosk@example.com'

export function getKioskEmail(): string {
  const fromPublic = process.env.NEXT_PUBLIC_KIOSK_EMAIL?.trim()
  return fromPublic || defaultKioskEmail
}
