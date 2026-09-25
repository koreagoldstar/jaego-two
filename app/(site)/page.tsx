import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Check, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { FEATURES } from '@/components/site/features'
import { PhoneMock } from '@/components/site/PhoneMock'
import { CtaBand } from '@/components/site/CtaBand'
import { PUBLIC_PLANS, TRIAL_DAYS, formatWon } from '@/lib/saas/plans'

export const dynamic = 'force-dynamic'

const STEPS = [
  { n: '1', title: '가입하고 품목 등록', desc: '회사명과 이메일로 가입한 뒤, 품목을 하나씩 또는 한 번에 등록합니다.' },
  { n: '2', title: '라벨 인쇄해서 부착', desc: '품목별 바코드·QR 라벨을 만들어 인쇄하고 장비와 선반에 붙입니다.' },
  { n: '3', title: '휴대폰으로 스캔', desc: '들어오고 나갈 때 스캔만 하면 재고와 이력이 자동으로 정리됩니다.' },
]

const AUDIENCES = [
  { title: '장비 대여·설치 업체', desc: '현장마다 나가고 들어오는 장비를 정확하게' },
  { title: '자재 창고 운영', desc: '입고·출고와 남은 수량을 실시간으로' },
  { title: '소규모 제조·유통', desc: '엑셀 대신 스캔 한 번으로 재고 정리' },
]

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const mainFeatures = FEATURES.filter(f => f.main)

  return (
    <>
      {/* 히어로 */}
      <section className="relative overflow-hidden bg-stone-900 text-white">
        {/* 바코드 줄무늬 배경 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, #fff 0 3px, transparent 3px 7px, #fff 7px 8px, transparent 8px 14px, #fff 14px 19px, transparent 19px 24px)',
          }}
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="inline-block rounded-full border border-brand-500/40 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-300">
              현장형 재고관리 서비스
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
              바코드 한 번으로
              <br />
              끝나는 <span className="text-brand-400">오늘의 재고</span>
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-stone-300">
              엑셀과 수기 장부는 이제 그만. 휴대폰 카메라로 스캔하면 입고·출고·이력이 한 번에 정리됩니다. 장비 한 대
              단위 추적과 프로젝트별 자재 관리까지 지원합니다.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3.5 font-semibold text-stone-950 shadow-sm hover:bg-brand-400"
              >
                {TRIAL_DAYS}일 무료로 시작하기 <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center justify-center rounded-xl border border-stone-600 px-6 py-3.5 font-semibold text-stone-100 hover:bg-stone-800"
              >
                기능 둘러보기
              </Link>
            </div>
            <p className="mt-4 text-sm text-stone-400">
              카드 등록 없이 가입 · 월 {formatWon(PUBLIC_PLANS[0].monthlyPrice)}원부터 (VAT 포함)
            </p>
          </div>
          <div className="relative">
            <div className="absolute inset-0 -z-10 mx-auto h-80 w-80 translate-y-10 rounded-full bg-brand-500/25 blur-3xl" />
            <PhoneMock />
          </div>
        </div>
      </section>

      {/* 이런 분께 */}
      <section className="border-y border-stone-100 bg-white px-4 py-12">
        <div className="mx-auto grid max-w-5xl gap-4 text-center sm:grid-cols-3">
          {AUDIENCES.map(a => (
            <div key={a.title} className="rounded-2xl bg-stone-50 px-5 py-6">
              <p className="font-semibold text-stone-900">{a.title}</p>
              <p className="mt-1 text-sm text-stone-500">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 핵심 기능 */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-stone-900">재고관리에 필요한 건 다 있습니다</h2>
            <p className="mt-3 text-stone-600">실제 장비 업체 현장에서 매일 쓰며 다듬은 기능입니다.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {mainFeatures.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-stone-200 p-6 transition-shadow hover:shadow-md">
                <div className="inline-flex rounded-xl bg-brand-600/10 p-2.5 text-brand-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-stone-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/features" className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline">
              전체 기능 보기 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 사용 순서 */}
      <section className="bg-stone-50 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-stone-900">시작은 3단계면 충분합니다</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map(s => (
              <div key={s.n} className="rounded-2xl bg-white p-6 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-stone-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 요금 요약 */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-stone-900">품목 수에 맞춰 고르는 요금제</h2>
            <p className="mt-3 text-stone-600">모든 요금제에서 모든 기능을 씁니다. 직원·기기 수 제한도 없습니다.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PUBLIC_PLANS.map(p => (
              <div
                key={p.id}
                className={`rounded-2xl border p-6 ${p.highlight ? 'border-brand-600 ring-1 ring-brand-600' : 'border-stone-200'}`}
              >
                <p className="font-semibold text-stone-900">{p.name}</p>
                <p className="mt-1 text-sm text-stone-500">{p.summary}</p>
                <p className="mt-4">
                  <span className="text-3xl font-bold text-stone-900">{formatWon(p.monthlyPrice)}</span>
                  <span className="text-stone-500">원/월</span>
                </p>
                <p className="text-xs text-stone-400">부가세 포함</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/pricing" className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline">
              요금 자세히 보기 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 맞춤 제작 */}
      <section className="px-4 pb-4">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 rounded-3xl bg-stone-900 p-8 text-white md:flex-row md:items-center md:p-12">
          <div className="rounded-2xl bg-white/10 p-3">
            <Wrench className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">우리 회사에 딱 맞는 기능이 필요하다면</h2>
            <p className="mt-2 text-stone-300">
              전용 라벨 양식, 거래처 관리, 기존 시스템 연동 등 원하시는 기능을 맞춤으로 만들어 드립니다.
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-300">
              {['요구사항 무료 상담', '별도 견적', '기존 데이터 그대로'].map(t => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-brand-400" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <Link
            href="/custom"
            className="shrink-0 rounded-xl bg-white px-6 py-3.5 font-semibold text-stone-900 hover:bg-stone-100"
          >
            맞춤 제작 알아보기
          </Link>
        </div>
      </section>

      <CtaBand />
    </>
  )
}
