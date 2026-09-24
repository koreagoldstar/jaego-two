import Link from 'next/link'
import { TRIAL_DAYS } from '@/lib/saas/plans'

export function CtaBand({
  title = '오늘 재고, 오늘 바로 정리하세요',
  desc = `가입 후 ${TRIAL_DAYS}일 동안 모든 기능을 무료로 써 보세요. 카드 등록 없이 시작합니다.`,
}: {
  title?: string
  desc?: string
}) {
  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-5xl rounded-3xl bg-blue-600 px-6 py-12 text-center text-white md:px-12">
        <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-blue-100">{desc}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/signup" className="rounded-xl bg-white px-6 py-3.5 font-semibold text-blue-700 hover:bg-blue-50">
            무료로 시작하기
          </Link>
          <Link
            href="/contact"
            className="rounded-xl border border-blue-300/60 px-6 py-3.5 font-semibold text-white hover:bg-blue-500"
          >
            도입 문의하기
          </Link>
        </div>
      </div>
    </section>
  )
}
