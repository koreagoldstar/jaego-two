import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { submitInquiryAction } from './actions'

export const metadata: Metadata = {
  title: '문의하기',
  description: '도입 상담, 요금제 변경, 맞춤 제작 문의를 남겨 주세요.',
}

const KIND_OPTIONS = [
  { value: 'general', label: '도입 상담' },
  { value: 'plan', label: '요금제·결제' },
  { value: 'custom', label: '맞춤 제작' },
]

const input =
  'w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30'

function one(v: string | string[] | undefined) {
  return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined
}

export default function ContactPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const sent = one(searchParams.sent) === '1'
  const error = one(searchParams.error)
  const kindParam = one(searchParams.kind)
  const kind = KIND_OPTIONS.some(o => o.value === kindParam) ? kindParam : 'general'

  return (
    <section className="bg-gradient-to-b from-brand-50 to-white px-4 py-16 md:py-20">
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <p className="text-sm font-semibold text-brand-600">문의하기</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-stone-900">무엇이든 물어보세요</h1>
          <p className="mt-3 text-stone-600">남겨 주신 연락처로 확인 후 빠르게 연락드립니다.</p>
        </div>

        {sent ? (
          <div className="mt-10 rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h2 className="mt-4 text-xl font-bold text-stone-900">문의가 접수되었습니다</h2>
            <p className="mt-2 text-stone-600">확인 후 남겨 주신 연락처로 연락드리겠습니다.</p>
            <Link href="/" className="mt-6 inline-block font-semibold text-brand-600 hover:underline">
              홈으로 돌아가기
            </Link>
          </div>
        ) : (
          <form
            action={submitInquiryAction}
            className="mt-10 space-y-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8"
          >
            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-stone-700">문의 종류</legend>
              <div className="grid grid-cols-3 gap-2">
                {KIND_OPTIONS.map(o => (
                  <label key={o.value} className="cursor-pointer">
                    <input type="radio" name="kind" value={o.value} defaultChecked={kind === o.value} className="peer sr-only" />
                    <span className="block rounded-xl border border-stone-200 px-2 py-2.5 text-center text-sm text-stone-600 peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:font-semibold peer-checked:text-brand-700">
                      {o.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="company_name" className="mb-1 block text-sm font-medium text-stone-700">
                  회사명 <span className="text-red-500">*</span>
                </label>
                <input id="company_name" name="company_name" required maxLength={100} className={input} />
              </div>
              <div>
                <label htmlFor="contact_name" className="mb-1 block text-sm font-medium text-stone-700">
                  담당자
                </label>
                <input id="contact_name" name="contact_name" maxLength={50} className={input} />
              </div>
              <div>
                <label htmlFor="phone" className="mb-1 block text-sm font-medium text-stone-700">
                  전화번호
                </label>
                <input id="phone" name="phone" type="tel" maxLength={30} className={input} placeholder="010-0000-0000" />
              </div>
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-stone-700">
                  이메일
                </label>
                <input id="email" name="email" type="email" maxLength={200} className={input} />
              </div>
            </div>

            <div>
              <label htmlFor="message" className="mb-1 block text-sm font-medium text-stone-700">
                문의 내용 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={6}
                maxLength={5000}
                className={input}
                placeholder="관리하는 품목 수, 필요한 기능, 궁금한 점을 적어 주세요."
              />
            </div>

            {/* 스팸 방지용 숨김 칸 */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

            {error && (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <p className="text-xs text-stone-400">
              전화번호나 이메일 중 하나는 꼭 남겨 주세요. 입력하신 정보는 문의 답변에만 사용합니다.
            </p>
            <button type="submit" className="w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white hover:bg-brand-700">
              문의 보내기
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
