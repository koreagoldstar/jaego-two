'use client'

import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export function RefreshLotsButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100/80"
    >
      <RefreshCw className="w-3.5 h-3.5" />
      다시 불러오기
    </button>
  )
}
