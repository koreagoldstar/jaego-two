import { Suspense } from 'react'
import { MoveStockClient } from '@/components/MoveStockClient'

export const dynamic = 'force-dynamic'

export default function MoveAppPage() {
  return (
    <Suspense fallback={<div className="text-center text-slate-500 py-12">로딩…</div>}>
      <MoveStockClient />
    </Suspense>
  )
}
