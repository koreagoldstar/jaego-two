import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * 로그인 사용자를 "데이터 주인 계정" 기준으로 돌려줍니다. (supabase.auth.getUser() 대신 사용)
 *
 * 여러 이메일이 같은 재고를 쓰는 경우 account_members 에 (공유 계정 → 주인 계정) 이 등록되어 있고,
 * 이때 user.id 를 주인 계정 id 로 바꿔서, 기존 `.eq('user_id', user.id)` 코드가 그대로 주인 데이터를 보게 합니다.
 * DB 쪽 RLS·함수도 public.data_owner_id() 로 같은 규칙을 씁니다 (020_account_members.sql).
 */
export async function getDataUser(supabase: SupabaseClient) {
  const res = await supabase.auth.getUser()
  const user = res.data.user
  if (!user) return res

  const { data } = await supabase
    .from('account_members')
    .select('owner_user_id')
    .eq('member_user_id', user.id)
    .maybeSingle()
  const ownerId = (data as { owner_user_id?: string } | null)?.owner_user_id
  if (!ownerId) return res

  return { ...res, data: { user: { ...user, id: ownerId } as User } }
}
