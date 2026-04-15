'use client'

import { Loader2, Stethoscope } from 'lucide-react'
import { useCallback, useState } from 'react'

export function DiagnoseStockLotsButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    setResult(null)
    setOpen(true)
    try {
      const r = await fetch('/api/health/stock-lots', { credentials: 'include', cache: 'no-store' })
      const j = (await r.json()) as unknown
      setResult(JSON.stringify(j, null, 2))
    } catch (e) {
      setResult(String(e))
    }
    setLoading(false)
  }, [])

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void run()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/80 bg-amber-100/50 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-200/60 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Stethoscope className="w-3.5 h-3.5" />}
        DB 연결 진단 (앱이 쓰는 Supabase 확인)
      </button>
      {open && result && (
        <pre className="max-h-64 overflow-auto rounded-lg border border-amber-200/80 bg-white/90 p-2 text-[10px] leading-relaxed text-slate-800 whitespace-pre-wrap break-all">
          {result}
        </pre>
      )}
    </div>
  )
}
