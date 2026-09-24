import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** 가입 인증 메일 링크 → 세션 교환. 다른 기기에서 열면 교환이 안 되므로 로그인 화면으로 안내 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  const u = new URL('/login', request.url)
  u.searchParams.set('notice', '이메일 인증이 완료되었습니다. 로그인해 주세요.')
  return NextResponse.redirect(u)
}
