import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseEnvStatus } from '@/lib/supabase/supabasePublicEnv'
import { formatAuthError } from '@/lib/auth-errors'
import { isPublicPlanId } from '@/lib/saas/plans'
import { SAAS_MODE } from '@/lib/saas/mode'

function back(request: NextRequest, params: Record<string, string>) {
  const u = new URL('/signup', request.url)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v.slice(0, 800))
  return NextResponse.redirect(u, 303)
}

export async function POST(request: NextRequest) {
  if (!SAAS_MODE) return NextResponse.redirect(new URL('/login', request.url), 303)

  const form = await request.formData()
  const companyName = String(form.get('company_name') ?? '').trim()
  const contactName = String(form.get('contact_name') ?? '').trim()
  const phone = String(form.get('phone') ?? '').trim()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  const passwordConfirm = String(form.get('password_confirm') ?? '')
  const planRaw = String(form.get('plan') ?? 'basic')
  const plan = isPublicPlanId(planRaw) ? planRaw : 'basic'
  const agreed = form.get('agree') === 'on'

  const keep = { plan, company: companyName, name: contactName, phone, email }
  const fail = (error: string) => back(request, { ...keep, error })

  if (!companyName) return fail('회사명을 입력해 주세요.')
  if (companyName.length > 100) return fail('회사명이 너무 깁니다.')
  if (!email || !email.includes('@')) return fail('올바른 이메일 주소를 입력해 주세요.')
  if (password.length < 6) return fail('비밀번호는 6자 이상으로 입력해 주세요.')
  if (password !== passwordConfirm) return fail('비밀번호 확인이 일치하지 않습니다.')
  if (!agreed) return fail('이용약관 및 개인정보 수집·이용에 동의해 주세요.')

  const env = getSupabaseEnvStatus()
  if (!env.ok) return fail('서버 설정 오류입니다. 잠시 후 다시 시도해 주세요.')

  const response = NextResponse.redirect(new URL('/dashboard', request.url), 303)
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: new URL('/auth/callback', request.url).toString(),
      data: { company_name: companyName, contact_name: contactName, phone, plan_id: plan },
    },
  })

  if (error) {
    console.error('[auth/signup]', email, error.code, error.message)
    return fail(formatAuthError(error.message))
  }

  // 이미 가입된 이메일이면 Supabase 는 identities 가 빈 사용자를 돌려줌
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return fail('이미 가입된 이메일입니다. 로그인해 주세요.')
  }

  // Supabase 에서 이메일 인증을 켜 둔 경우: 세션 없음 → 메일 확인 안내
  if (!data.session) {
    return back(request, { sent: email })
  }

  return response
}
