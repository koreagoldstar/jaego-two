import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * 로그인 사용자를 "데이터 주인 계정" 기준으로 돌려줍니다. (supabase.auth.getUser() 대신 사용)
 *
 * 여러 이메일이 같은 재고를 쓰는 경우 account_members 에 (공유 계정 → 주인 계정) 이 등록되어 있고,
 * 이때 user.id 를 주인 계정 id 로 바꿔서, 기존 `.eq('user_id', user.id)` 코드가 그대로 주인 데이터를 보게 합니다.
 * DB 쪽 RLS·함수도 public.data_owner_id() 로 같은 규칙을 씁니다 (020_account_members.sql).
 *
 * 속도: 화면마다 인증 서버를 왕복하지 않도록 쿠키의 세션(getSession)을 씁니다.
 *  - 세션이 위조·만료돼도 데이터는 못 봅니다. 모든 조회·수정은 DB 가 JWT 를 직접 검증(RLS)하기 때문입니다.
 *  - 주인 계정 id 는 DB 함수(JWT 기준)로 한 번 확인한 뒤 잠깐 기억해 둡니다.
 */
const OWNER_TTL_MS = 5 * 60 * 1000
const ownerCache = new Map<string, { ownerId: string; exp: number }>()
const STORAGE_PREFIX = 'jaego-data-owner:'

function readCachedOwner(userId: string): string | null {
  const hit = ownerCache.get(userId)
  if (hit && hit.exp > Date.now()) return hit.ownerId
  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_PREFIX + userId)
      if (raw) {
        const parsed = JSON.parse(raw) as { ownerId: string; exp: number }
        if (parsed.exp > Date.now()) {
          ownerCache.set(userId, parsed)
          return parsed.ownerId
        }
      }
    } catch {
      /* private mode */
    }
  }
  return null
}

function writeCachedOwner(userId: string, ownerId: string) {
  const entry = { ownerId, exp: Date.now() + OWNER_TTL_MS }
  ownerCache.set(userId, entry)
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(entry))
    } catch {
      /* private mode */
    }
  }
}

async function resolveOwnerId(supabase: SupabaseClient, userId: string): Promise<string> {
  const cached = readCachedOwner(userId)
  if (cached) return cached
  const { data, error } = await supabase.rpc('data_owner_id')
  // 020 마이그레이션 전(함수 없음)이면 본인 계정 그대로
  const ownerId = !error && typeof data === 'string' && data ? data : userId
  if (!error) writeCachedOwner(userId, ownerId)
  return ownerId
}

export async function getDataUser(
  supabase: SupabaseClient,
): Promise<{ data: { user: User | null }; error: Error | null }> {
  const { data, error } = await supabase.auth.getSession()
  const user = data.session?.user ?? null
  if (!user) return { data: { user: null }, error }

  const ownerId = await resolveOwnerId(supabase, user.id)
  if (ownerId === user.id) return { data: { user }, error: null }
  return { data: { user: { ...user, id: ownerId } as User }, error: null }
}
