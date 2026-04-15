import { SignOutButton } from '@/components/SignOutButton'
import { Download, FileText } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-slate-900">설정</h1>
        <p className="text-sm text-slate-500">바로가기, 데이터 백업 및 로그아웃</p>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100 shadow-sm overflow-hidden">
        <a
          href="/api/backup"
          className="flex items-center gap-3 px-4 py-4 text-slate-900 hover:bg-slate-50"
        >
          <Download className="w-5 h-5 text-slate-500" />
          <span>
            <span className="font-medium">전체 데이터 백업 (JSON)</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              품목, 입출고, 이력, 입고 단위, 프로젝트 계획을 한 파일로 내려받습니다
            </span>
          </span>
        </a>
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

      <p className="text-xs text-slate-500">
        백업은 브라우저에서 로그인된 계정 기준으로만 포함됩니다. 복원은 Supabase SQL/대시보드 또는 별도 도구가 필요할 수 있습니다.{' '}
        <Link href="/transactions" className="text-blue-600 hover:underline">
          입출고 이력
        </Link>
        에서 항목별 수정도 가능합니다.
      </p>

      <SignOutButton />
    </div>
  )
}
