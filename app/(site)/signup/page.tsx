import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PUBLIC_PLANS, TRIAL_DAYS, formatWon, isPublicPlanId } from '@/lib/saas/plans'

export const metadata: Metadata = {
  title: '무료로 시작하기',
}

export const dynamic = 'force-dynamic'

const input =
  'w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30'

function one(v: string | string[] | undefined) {
  return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const sent = one(searchParams.sent)
  const error = one(searchParams.error)
  const planParam = one(searchParams.plan) ?? ''
  const plan = isPublicPlanId(planParam) ? planParam : 'basic'

  if (sent) {
    return (
      <section className="px-4 py-20">
        <div className="mx-auto max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <MailCheck className="mx-auto h-12 w-12 text-brand-600" />
          <h1 className="mt-4 text-xl font-bold text-stone-900">인증 메일을 보냈습니다</h1>
          <p className="mt-2 text-stone-600">
            <strong className="text-stone-900">{sent}</strong> 메일함에서 인증 링크를 누르면 가입이 완료됩니다.
          </p>
          <p className="mt-2 text-sm text-stone-400">메일이 안 보이면 스팸함도 확인해 주세요.</p>
          <Link href="/login" className="mt-6 inline-block font-semibold text-brand-600 hover:underline">
            로그인 화면으로
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-gradient-to-b from-brand-50 to-white px-4 py-14 md:py-20">
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">{TRIAL_DAYS}일 무료로 시작하기</h1>
          <p className="mt-3 text-stone-600">카드 등록 없이 바로 쓸 수 있습니다. 가입한 계정은 회사 직원이 함께 씁니다.</p>
        </div>

        <form
          action="/api/auth/signup"
          method="POST"
          className="mt-10 space-y-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8"
        >
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-stone-700">요금제 (체험 후 결제)</legend>
            <div className="grid grid-cols-3 gap-2">
              {PUBLIC_PLANS.map(p => (
                <label key={p.id} className="cursor-pointer">
                  <input type="radio" name="plan" value={p.id} defaultChecked={plan === p.id} className="peer sr-only" />
                  <span className="block rounded-xl border border-stone-200 px-2 py-3 text-center peer-checked:border-brand-600 peer-checked:bg-brand-50">
                    <span className="block text-sm font-semibold text-stone-900">{p.name}</span>
                    <span className="block text-xs text-stone-500">{formatWon(p.monthlyPrice)}원/월</span>
                    <span className="mt-0.5 block text-[11px] text-stone-400">
                      {p.itemLimit === null ? '무제한' : `${formatWon(p.itemLimit)}개`}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-stone-400">가격은 부가세 포함이며, 나중에 언제든 바꿀 수 있습니다.</p>
          </fieldset>

          <div>
            <label htmlFor="company_name" className="mb-1 block text-sm font-medium text-stone-700">
              회사명 <span className="text-red-500">*</span>
            </label>
            <input
              id="company_name"
              name="company_name"
              required
              maxLength={100}
              defaultValue={one(searchParams.company)}
              className={input}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contact_name" className="mb-1 block text-sm font-medium text-stone-700">
                담당자
              </label>
              <input
                id="contact_name"
                name="contact_name"
                maxLength={50}
                defaultValue={one(searchParams.name)}
                className={input}
              />
            </div>
            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium text-stone-700">
                연락처
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                maxLength={30}
                defaultValue={one(searchParams.phone)}
                className={input}
                placeholder="010-0000-0000"
              />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-stone-700">
              로그인 이메일 <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={one(searchParams.email)}
              className={input}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-stone-700">
                비밀번호 <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className={input}
                placeholder="6자 이상"
              />
            </div>
            <div>
              <label htmlFor="password_confirm" className="mb-1 block text-sm font-medium text-stone-700">
                비밀번호 확인 <span className="text-red-500">*</span>
              </label>
              <input
                id="password_confirm"
                name="password_confirm"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className={input}
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-stone-600">
            <input type="checkbox" name="agree" required className="mt-0.5 h-4 w-4 rounded border-stone-300" />
            이용약관 및 개인정보 수집·이용에 동의합니다. (필수)
          </label>

          {error && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button type="submit" className="w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white hover:bg-brand-700">
            가입하고 시작하기
          </button>
          <p className="text-center text-sm text-stone-500">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              로그인
            </Link>
          </p>
        </form>
      </div>
    </section>
  )
}
