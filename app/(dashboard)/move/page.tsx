import Link from 'next/link'
import { Suspense } from 'react'
import { MoveStockClient } from '@/components/MoveStockClient'

export default function MovePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">입·출고</h1>
        <p className="text-sm text-slate-500">휴대폰에서 품목·프로젝트·수량을 입력하세요.</p>
        <p className="text-sm mt-2">
          <Link
            href="/move-app"
            className="text-blue-600 font-medium underline underline-offset-2 hover:text-blue-700"
          >
            입출고 전용 화면 열기
          </Link>
          <span className="text-slate-500"> — 필드용으로 메뉴 없이 바로 처리</span>
        </p>
        <p className="text-sm mt-1">
          <Link
            href="/move-bulk"
            className="text-orange-600 font-medium underline underline-offset-2 hover:text-orange-700"
          >
            다중 스캔 일괄 출고
          </Link>
          <span className="text-slate-500"> — 여러 바코드를 같은 프로젝트로 한 번에 출고</span>
        </p>
      </div>
      <Suspense fallback={<div className="text-center text-slate-500 py-8">로딩…</div>}>
        <MoveStockClient />
      </Suspense>
    </div>
  )
}
