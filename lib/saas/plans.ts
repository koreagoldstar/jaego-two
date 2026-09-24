/** 요금제 — supabase/migrations/018_saas_workspaces.sql 의 plans 테이블과 값을 맞춰 두세요. */
export type PlanId = 'basic' | 'standard' | 'pro' | 'internal'

export type Plan = {
  id: PlanId
  name: string
  /** null = 무제한 */
  itemLimit: number | null
  /** 원/월, 부가세 포함 */
  monthlyPrice: number
  summary: string
  highlight?: boolean
}

export const PUBLIC_PLANS: Plan[] = [
  { id: 'basic', name: '베이직', itemLimit: 2000, monthlyPrice: 25000, summary: '품목 2,000개까지' },
  {
    id: 'standard',
    name: '스탠다드',
    itemLimit: 5000,
    monthlyPrice: 45000,
    summary: '품목 5,000개까지',
    highlight: true,
  },
  { id: 'pro', name: '프로', itemLimit: null, monthlyPrice: 70000, summary: '품목 5,000개 초과 · 무제한' },
]

const INTERNAL_PLAN: Plan = { id: 'internal', name: '내부용', itemLimit: null, monthlyPrice: 0, summary: '무제한' }

export const TRIAL_DAYS = 14

export function getPlan(id: string | null | undefined): Plan {
  if (id === 'internal') return INTERNAL_PLAN
  return PUBLIC_PLANS.find(p => p.id === id) ?? PUBLIC_PLANS[0]
}

export function isPublicPlanId(id: string): id is Exclude<PlanId, 'internal'> {
  return PUBLIC_PLANS.some(p => p.id === id)
}

export function formatWon(n: number): string {
  return n.toLocaleString('ko-KR')
}
