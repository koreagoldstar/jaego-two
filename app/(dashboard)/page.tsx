import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Package, ArrowLeftRight, ScanLine, Barcode, History } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let totalQty = 0
  let itemCount = 0
  if (user) {
    const { data: items } = await supabase.from('items').select('quantity').eq('user_id', user.id)
    itemCount = items?.length ?? 0
    totalQty = items?.reduce((s, r) => s + (r.quantity ?? 0), 0) ?? 0
  }

  const cards = [
    { href: '/items', label: '품목 관리', desc: '등록·수정', icon: Package, color: 'bg-white' },
    { href: '/move', label: '입·출고', desc: '휴대폰에서 처리', icon: ArrowLeftRight, color: 'bg-blue-50' },
    { href: '/scan', label: '바코드 스캔', desc: '카메라로 조회', icon: ScanLine, color: 'bg-white' },
    { href: '/barcode', label: '바코드 만들기', desc: '시리얼 포함', icon: Barcode, color: 'bg-white' },
    { href: '/transactions', label: '입출고 이력', desc: '최근 기록', icon: History, color: 'bg-white' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">대시보드</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">총 품목</p>
          <p className="text-2xl font-semibold text-slate-900">{itemCount}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">총 수량</p>
          <p className="text-2xl font-semibold text-blue-600">{totalQty}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(({ href, label, desc, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-start gap-3 rounded-2xl border border-slate-200 p-4 shadow-sm active:scale-[0.99] transition-transform ${color}`}
          >
            <div className="rounded-xl bg-blue-600/10 p-2 text-blue-600">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">{label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
