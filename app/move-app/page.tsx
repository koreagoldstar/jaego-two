import { Suspense } from 'react'
import { MoveStockClient } from '@/components/MoveStockClient'

export const dynamic = 'force-dynamic'

export default function MoveAppPage() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        품목·수량·<strong className="text-slate-800">프로젝트</strong>를 입력한 뒤 입고 또는 출고를 누르세요. 이 화면만 즐겨찾기/홈 화면에
        추가해 두면 바로 입출고할 수 있습니다.
      </p>
      <Suspense fallback={<div className="text-center text-slate-500 py-12">로딩…</div>}>
        <MoveStockClient />
      </Suspense>
    </div>
  )
}
