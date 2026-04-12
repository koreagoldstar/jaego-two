import { Suspense } from 'react'
import { MoveStockClient } from '@/components/MoveStockClient'

export const dynamic = 'force-dynamic'

export default function MovePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">입·출고</h1>
        <p className="text-sm text-slate-500">휴대폰에서 품목을 고르고 수량을 입력하세요.</p>
      </div>
      <Suspense fallback={<div className="text-center text-slate-500 py-8">로딩…</div>}>
        <MoveStockClient />
      </Suspense>
    </div>
  )
}
