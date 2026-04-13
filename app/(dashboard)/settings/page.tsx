import { SignOutButton } from '@/components/SignOutButton'
import { FileText } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-slate-900">설정</h1>
        <p className="text-sm text-slate-500">바로가기 및 로그아웃</p>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100 shadow-sm overflow-hidden">
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
