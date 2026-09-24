import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { FEATURES } from '@/components/site/features'
import { CtaBand } from '@/components/site/CtaBand'

export const metadata: Metadata = {
  title: '기능 소개',
  description: '품목 관리, 휴대폰 입출고, 바코드·QR 스캔과 라벨, 프로젝트별 자재 계획, 엑셀 내보내기까지 — 오늘의 재고 전체 기능.',
}

export default function FeaturesPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-blue-50 to-white px-4 pb-8 pt-16 text-center md:pt-20">
        <p className="text-sm font-semibold text-blue-600">기능 소개</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
          창고에서 현장까지, 재고의 모든 순간
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-600">
          모든 요금제에서 아래 기능을 전부 쓸 수 있습니다. 휴대폰, 태블릿, PC 어디서든 같은 화면으로 이어집니다.
        </p>
      </section>

      <section className="px-4 py-12">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, desc, points }) => (
            <article key={title} className="flex gap-5 rounded-2xl border border-slate-200 p-6">
              <div className="h-fit shrink-0 rounded-xl bg-blue-600/10 p-3 text-blue-600">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{desc}</p>
                <ul className="mt-3 space-y-1">
                  {points.map(p => (
                    <li key={p} className="flex items-center gap-2 text-sm text-slate-700">
                      <Check className="h-4 w-4 shrink-0 text-blue-600" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <CtaBand />
    </>
  )
}
