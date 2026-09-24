import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { CtaBand } from '@/components/site/CtaBand'
import { PUBLIC_PLANS, TRIAL_DAYS, formatWon, withVat } from '@/lib/saas/plans'

export const metadata: Metadata = {
  title: '요금 안내',
  description: '품목 2,000개까지 월 2만원, 10,000개까지 월 3만원, 그 이상 월 5만원 (VAT 별도). 모든 기능 포함.',
}

const INCLUDED = [
  '품목 관리 · 일괄 등록',
  '휴대폰 입·출고',
  '바코드·QR 스캔',
  '바코드·QR 라벨 만들기',
  '개별 단위 추적',
  '일괄 출고 · 되돌리기',
  '프로젝트별 자재 계획',
  '재고 요약표',
  '입출고 이력 조회',
  '엑셀 내보내기',
  '데이터 백업',
  '직원·기기 수 제한 없음',
]

const FAQ = [
  {
    q: '무료 체험이 끝나면 자동으로 결제되나요?',
    a: `아니요. ${TRIAL_DAYS}일 체험은 카드 등록 없이 시작하며, 체험이 끝나기 전에 결제 안내를 드립니다. 원하실 때만 결제하시면 됩니다.`,
  },
  {
    q: '품목 수는 어떻게 세나요?',
    a: '등록된 품목(제품 종류)의 개수입니다. 같은 품목의 수량이 1,000개여도 품목은 1개로 셉니다. 입출고 횟수와 수량에는 제한이 없습니다.',
  },
  {
    q: '품목이 한도를 넘으면 어떻게 되나요?',
    a: '기존 데이터는 그대로 쓰실 수 있고, 새 품목 등록만 막힙니다. 설정 화면에서 상위 요금제로 변경을 요청하시면 바로 늘려 드립니다.',
  },
  {
    q: '요금제는 언제든 바꿀 수 있나요?',
    a: '네. 품목 수에 맞춰 언제든 올리거나 내릴 수 있습니다.',
  },
  {
    q: '우리 회사에만 필요한 기능이 있어요.',
    a: '요금제 가격은 현재 제공 기능 기준입니다. 추가 기능은 회사 요구에 맞춰 맞춤 제작해 드리며, 비용은 내용에 따라 별도로 견적을 드립니다.',
  },
]

export default function PricingPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-blue-50 to-white px-4 pb-4 pt-16 text-center md:pt-20">
        <p className="text-sm font-semibold text-blue-600">요금 안내</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
          품목 수만 보고 고르세요
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-600">
          모든 요금제에 모든 기능이 들어 있습니다. {TRIAL_DAYS}일 무료 체험으로 먼저 써 보세요.
        </p>
      </section>

      <section className="px-4 py-12">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
          {PUBLIC_PLANS.map(p => (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-3xl border bg-white p-7 ${
                p.highlight ? 'border-blue-600 shadow-lg shadow-blue-600/10 ring-1 ring-blue-600' : 'border-slate-200'
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                  가장 많이 선택
                </span>
              )}
              <h2 className="text-xl font-bold text-slate-900">{p.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{p.summary}</p>
              <p className="mt-6">
                <span className="text-4xl font-extrabold text-slate-900">{formatWon(p.monthlyPrice)}</span>
                <span className="text-slate-500">원 / 월</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                부가세 별도 (VAT 포함 {formatWon(withVat(p.monthlyPrice))}원)
              </p>
              <div className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <span className="text-slate-500">등록 가능 품목</span>
                <p className="font-semibold text-slate-900">
                  {p.itemLimit === null ? '무제한' : `${formatWon(p.itemLimit)}개까지`}
                </p>
              </div>
              <Link
                href={`/signup?plan=${p.id}`}
                className={`mt-6 block rounded-xl py-3.5 text-center font-semibold ${
                  p.highlight
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border border-slate-300 text-slate-800 hover:bg-slate-50'
                }`}
              >
                {TRIAL_DAYS}일 무료 체험
              </Link>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-5xl rounded-3xl border border-slate-200 p-7">
          <h2 className="font-bold text-slate-900">모든 요금제에 포함</h2>
          <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDED.map(t => (
              <li key={t} className="flex items-center gap-2 text-sm text-slate-700">
                <Check className="h-4 w-4 shrink-0 text-blue-600" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-5 flex max-w-5xl flex-col items-start justify-between gap-4 rounded-3xl bg-slate-900 p-7 text-white md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-bold">맞춤 기능 제작 · 별도 견적</h2>
            <p className="mt-1 text-sm text-slate-300">
              위 요금은 현재 제공 기능 기준입니다. 회사에 필요한 기능은 원하시는 대로 만들어 드리고, 비용은 따로
              책정합니다.
            </p>
          </div>
          <Link href="/custom" className="shrink-0 rounded-xl bg-white px-5 py-3 font-semibold text-slate-900 hover:bg-slate-100">
            맞춤 제작 알아보기
          </Link>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold text-slate-900">자주 묻는 질문</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map(f => (
              <details key={f.q} className="group rounded-2xl bg-white p-5 shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-slate-900">
                  {f.q}
                  <span className="ml-4 text-slate-400 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  )
}
