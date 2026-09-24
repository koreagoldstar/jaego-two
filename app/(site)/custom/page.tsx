import type { Metadata } from 'next'
import Link from 'next/link'
import { Tag, Users, Plug, FileText, Truck, LayoutDashboard } from 'lucide-react'
import { CtaBand } from '@/components/site/CtaBand'

export const metadata: Metadata = {
  title: '맞춤 제작',
  description: '회사 업무에 꼭 맞는 재고 기능을 맞춤으로 만들어 드립니다. 비용은 요구사항에 따라 별도 견적.',
}

const EXAMPLES = [
  { icon: Tag, title: '전용 라벨 양식', desc: '회사 로고, 자산번호, 원하는 크기의 라벨 인쇄 양식' },
  { icon: Truck, title: '거래처·납품 관리', desc: '거래처별 출고, 납품서·거래명세서 출력' },
  { icon: Users, title: '직원별 권한', desc: '관리자·현장 직원·조회 전용 등 역할별 화면과 권한' },
  { icon: Plug, title: '기존 시스템 연동', desc: 'ERP·회계 프로그램·쇼핑몰과 재고 데이터 연동' },
  { icon: FileText, title: '맞춤 보고서', desc: '월간 재고 보고서, 현장별 정산표 등 원하는 양식' },
  { icon: LayoutDashboard, title: '업종 전용 화면', desc: '대여 반납 일정, 유통기한, 수리 이력 등 업종 특화 기능' },
]

const PROCESS = [
  { n: '01', title: '상담', desc: '필요한 기능과 현재 업무 방식을 들려주세요. 상담은 무료입니다.' },
  { n: '02', title: '견적', desc: '기능 범위와 일정, 비용을 정리해 견적을 드립니다.' },
  { n: '03', title: '제작', desc: '중간 결과를 보여 드리며 의견을 반영해 만듭니다.' },
  { n: '04', title: '적용', desc: '쓰시던 계정과 데이터에 그대로 적용합니다. 사용 교육도 함께 드립니다.' },
]

export default function CustomPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-slate-100 to-white px-4 pb-8 pt-16 text-center md:pt-20">
        <p className="text-sm font-semibold text-blue-600">맞춤 제작</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
          우리 회사 방식대로 만드는 재고관리
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-600">
          기본 기능만으로 부족하다면, 원하시는 기능을 추가로 만들어 드립니다. 요금제는 그대로, 추가 기능 비용은
          요구사항에 따라 별도로 책정합니다.
        </p>
        <Link
          href="/contact?kind=custom"
          className="mt-8 inline-block rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white hover:bg-blue-700"
        >
          맞춤 제작 상담 신청
        </Link>
      </section>

      <section className="px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold text-slate-900">이런 기능을 만들 수 있습니다</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {EXAMPLES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-slate-200 p-6">
                <Icon className="h-6 w-6 text-blue-600" />
                <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">예시 외에도 필요한 기능이면 무엇이든 말씀해 주세요.</p>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-slate-900">진행 순서</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-4">
            {PROCESS.map(p => (
              <div key={p.n} className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-bold text-blue-600">{p.n}</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand title="필요한 기능, 편하게 말씀해 주세요" desc="요구사항을 남겨 주시면 확인 후 연락드립니다." />
    </>
  )
}
