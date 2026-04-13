import { Suspense } from 'react'
import { ScanClient } from '@/components/ScanClient'

export default function ScanPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">스캔</h1>
        <p className="text-sm text-slate-500">카메라로 바코드를 읽고 품목으로 이동합니다.</p>
      </div>
      <Suspense
        fallback={<div className="rounded-2xl bg-white border p-8 text-center text-slate-500">준비 중…</div>}
      >
        <ScanClient />
      </Suspense>
    </div>
  )
}
