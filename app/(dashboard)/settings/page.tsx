import Link from 'next/link'
import { SignOutButton } from '@/components/SignOutButton'
import { Barcode, History, FileText } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-slate-900">설정</h1>
        <p className="text-sm text-slate-500">바로가기 및 로그아웃</p>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100 shadow-sm overflow-hidden">
        <Link
          href="/barcode"
          className="flex items-center gap-3 px-4 py-4 text-slate-900 hover:bg-slate-50"
        >
          <Barcode className="w-5 h-5 text-blue-600" />
          바코드 만들기 (시리얼 포함)
        </Link>
        <Link
          href="/transactions"
          className="flex items-center gap-3 px-4 py-4 text-slate-900 hover:bg-slate-50"
        >
          <History className="w-5 h-5 text-blue-600" />
          입출고 이력
        </Link>
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 px-4 py-4 text-slate-900 hover:bg-slate-50"
        >
          <FileText className="w-5 h-5 text-slate-500" />
          Supabase 대시보드
        </a>
      </div>

      <SignOutButton />
    </div>
  )
}
