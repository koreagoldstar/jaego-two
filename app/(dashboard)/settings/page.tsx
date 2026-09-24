import { SignOutButton } from '@/components/SignOutButton'
import { InstallAppCard } from '@/components/InstallAppCard'
import { Download, Building2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getWorkspace, trialDaysLeft } from '@/lib/saas/workspace'
import { formatWon } from '@/lib/saas/plans'

export const dynamic = 'force-dynamic'

const STATUS_LABEL = {
  trial: '무료 체험 중',
  active: '이용 중',
  past_due: '결제 필요',
  canceled: '해지됨',
} as const

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const workspace = user ? await getWorkspace(supabase, user.id, { withItemCount: true }) : null
  const limit = workspace?.plan.itemLimit ?? null
  const used = workspace?.itemCount ?? 0
  const usagePct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const trialLeft = workspace?.status === 'trial' ? trialDaysLeft(workspace.trialEndsAt) : null

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-slate-900">설정</h1>
        <p className="text-sm text-slate-500">앱 설치, 바로가기, 데이터 백업 및 로그아웃</p>
      </div>

      {workspace && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-slate-500 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900 truncate">{workspace.companyName}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {workspace.plan.name} 요금제 · {STATUS_LABEL[workspace.status]}
                {trialLeft !== null && ` (${trialLeft}일 남음)`}
                {workspace.plan.monthlyPrice > 0 &&
                  ` · 월 ${formatWon(workspace.plan.monthlyPrice)}원 (VAT 별도)`}
              </p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>등록 품목</span>
              <span>
                {formatWon(used)}
                {limit !== null ? ` / ${formatWon(limit)}개` : '개 (무제한)'}
              </span>
            </div>
            {limit !== null && (
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${usagePct >= 90 ? 'bg-red-500' : 'bg-blue-600'}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            )}
          </div>
          {workspace.plan.id !== 'internal' && (
            <Link
              href="/contact?kind=plan"
              className="block text-center text-sm font-medium text-blue-600 border border-blue-200 rounded-xl py-2.5 hover:bg-blue-50"
            >
              요금제 변경 · 결제 문의
            </Link>
          )}
        </div>
      )}

      <InstallAppCard />

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
      </div>

      <p className="text-xs text-slate-500">
        백업에는 로그인한 회사 계정의 데이터만 포함됩니다. 복원이 필요하면 문의하기로 요청해 주세요.{' '}
        <Link href="/transactions" className="text-blue-600 hover:underline">
          입출고 이력
        </Link>
        에서 항목별 수정도 가능합니다.
      </p>

      <SignOutButton />
    </div>
  )
}
