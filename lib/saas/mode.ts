/**
 * 배포별 모드 — 같은 코드로 두 곳에 배포합니다.
 *  - 판매용(오늘의 재고): NEXT_PUBLIC_SAAS_MODE=1 → 소개 사이트·회원가입·요금제 사용
 *  - 신화유디텍 전용:    미설정 → `/` 는 바로 로그인/대시보드, 가입 불가
 * NEXT_PUBLIC_* 는 빌드 때 고정되므로 바꾸면 다시 배포해야 합니다.
 */
export const SAAS_MODE = process.env.NEXT_PUBLIC_SAAS_MODE === '1'

export const APP_NAME = SAAS_MODE ? '오늘의 재고' : '신화유디텍 장비'
