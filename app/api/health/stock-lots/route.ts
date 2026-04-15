import { createClient } from '@/lib/supabase/server'
import { getSupabaseEnvStatus } from '@/lib/supabase/supabasePublicEnv'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function projectHostFromEnv(): string {
  const s = getSupabaseEnvStatus()
  if (!s.ok) return '(NEXT_PUBLIC_SUPABASE_URL 미설정)'
  try {
    return new URL(s.url).hostname
  } catch {
    return '(URL 파싱 실패)'
  }
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  const projectHost = projectHostFromEnv()
  const { data, error } = await supabase.from('item_stock_lots').select('id').limit(1)

  const hints: string[] = []
  if (error) {
    const m = (error.message ?? '').toLowerCase()
    hints.push(
      'Supabase 대시보드 주소창의 프로젝트와, 아래 projectHost가 같은지 확인하세요. 다르면 Vercel/로컬 환경 변수가 다른 DB를 가리킵니다.'
    )
    hints.push(
      'SQL Editor에서 실행: select to_regclass(\'public.item_stock_lots\'); → null이면 테이블이 없음(007 전체 실행). uuid가 나오면 테이블은 있는데 API 캐시 문제일 수 있습니다.'
    )
    if (m.includes('schema cache') || m.includes('could not find the table') || error.code === 'PGRST205') {
      hints.push('NOTIFY 후에도 동일하면: Supabase → Settings → General → Project 일시 중지 후 다시 켜기(짧은 중단, 스키마/연결 새로고침).')
    }
  }

  return NextResponse.json({
    projectHost,
    loggedInAs: user.email ?? user.id,
    item_stock_lots: error
      ? { ok: false, code: error.code ?? null, message: error.message }
      : { ok: true, sampleRowCount: data?.length ?? 0 },
    hints,
  })
}
