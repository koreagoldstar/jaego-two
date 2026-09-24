/**
 * 운영자 알림 메일 (새 문의·새 가입) — Resend (https://resend.com, 월 3,000통 무료)
 *
 * 환경 변수 (판매용 배포에만):
 *   RESEND_API_KEY   Resend → API Keys 에서 발급
 *   NOTIFY_EMAIL     받을 주소 (기본 breakbug@naver.com)
 *   NOTIFY_FROM      보내는 주소 (기본 onboarding@resend.dev — 이 경우 Resend 가입 이메일로만 발송 가능)
 *
 * 키가 없거나 발송에 실패해도 문의 접수·가입은 그대로 성공시키고 서버 로그만 남깁니다.
 */
const DEFAULT_TO = 'breakbug@naver.com'

export async function notifyAdmin(subject: string, lines: Array<[string, string | null | undefined]>, replyTo?: string) {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) {
    console.warn('[notify] RESEND_API_KEY 없음 — 알림 메일 생략:', subject)
    return
  }
  const text = lines
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM?.trim() || '오늘의 재고 <onboarding@resend.dev>',
        to: [process.env.NOTIFY_EMAIL?.trim() || DEFAULT_TO],
        subject: `[오늘의 재고] ${subject}`,
        text,
        ...(replyTo && replyTo.includes('@') ? { reply_to: replyTo } : {}),
      }),
    })
    if (!res.ok) console.error('[notify] 발송 실패', res.status, await res.text())
  } catch (e) {
    console.error('[notify] 발송 오류', e)
  }
}
