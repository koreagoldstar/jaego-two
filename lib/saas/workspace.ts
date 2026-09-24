import type { SupabaseClient } from '@supabase/supabase-js'
import { getPlan, type Plan } from '@/lib/saas/plans'

export type Workspace = {
  companyName: string
  plan: Plan
  status: 'trial' | 'active' | 'past_due' | 'canceled'
  trialEndsAt: string | null
  itemCount: number | null
}

/** 워크스페이스 조회. 018 마이그레이션 전이면 null (앱은 기존처럼 동작) */
export async function getWorkspace(
  supabase: SupabaseClient,
  userId: string,
  opts: { withItemCount?: boolean } = {}
): Promise<Workspace | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('company_name, plan_id, status, trial_ends_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null

  let itemCount: number | null = null
  if (opts.withItemCount) {
    const { count } = await supabase
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    itemCount = count ?? null
  }

  return {
    companyName: data.company_name,
    plan: getPlan(data.plan_id),
    status: data.status,
    trialEndsAt: data.trial_ends_at,
    itemCount,
  }
}

export function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null
  const ms = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}
