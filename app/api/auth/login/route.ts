import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseEnvStatus } from '@/lib/supabase/supabasePublicEnv'
import { formatAuthError } from '@/lib/auth-errors'
import { getKioskEmail } from '@/lib/kiosk-auth'

function errRedirect(request: NextRequest, message: string) {
  const u = new URL('/login', request.url)
  u.searchParams.set('error', message.slice(0, 800))
  return NextResponse.redirect(u)
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const password = String(formData.get('password') ?? '').trim()

  const rawEmail = String(formData.get('email') ?? '').trim()
  const email = (rawEmail || getKioskEmail()).toLowerCase()

  if (!password) {
    return errRedirect(request, '비밀번호를 입력해 주세요.')
  }
  if (!email || !email.includes('@')) {
    return errRedirect(request, '올바른 이메일 주소를 입력해 주세요.')
  }

  const env = getSupabaseEnvStatus()
  if (!env.ok) {
    const hint =
      env.reason === 'missing_both'
        ? '.env.local 에 NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_ANON_KEY 를 모두 넣으세요.'
        : env.reason === 'missing_url'
          ? '.env.local 에 NEXT_PUBLIC_SUPABASE_URL 이 빠졌습니다.'
          : '.env.local 에 NEXT_PUBLIC_SUPABASE_ANON_KEY 가 빠졌습니다.'
    return errRedirect(
      request,
      'Supabase 연결 설정이 불완전합니다. ' +
        hint +
        ' 로컬은 .env.local 저장 후 dev 재시작, Vercel은 Project → Settings → Environment Variables 저장 후 Redeploy 하세요.'
    )
  }

  const okUrl = new URL('/', request.url)
  const response = NextResponse.redirect(okUrl)

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    const raw = [error.code, error.message].filter(Boolean).join(' · ')
    const msg =
      formatAuthError(error.message) +
      ` — ${raw}. Supabase Authentication → Users 에서 이메일「${email}」계정 비밀번호를 확인하거나 재설정하세요.`
    return errRedirect(request, msg)
  }

  if (!data.session) {
    return errRedirect(request, '세션이 만들어지지 않았습니다. 잠시 후 다시 시도하세요.')
  }

  return response
}
