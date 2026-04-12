const BUILD_URL = 'https://placeholder.supabase.co'
const BUILD_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjJni43kdQwgnWNReilDMblYTn_I0'

export type SupabaseEnvStatus =
  | { ok: true; url: string; key: string }
  | { ok: false; reason: 'missing_both' | 'missing_url' | 'missing_key' }

/** 서버에서만 쓰는 대체 이름(Vercel에 NEXT_PUBLIC 없이 넣은 경우 등) */
function resolveSupabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    ''
  )
}

function resolveSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    ''
  )
}

/** URL·anon 키가 둘 다 있어야 실제 프로젝트로 연결됩니다. 하나만 있으면 둘 다 예시값으로 바뀌어 로그인에 실패합니다. */
export function getSupabaseEnvStatus(): SupabaseEnvStatus {
  const url = resolveSupabaseUrl()
  const key = resolveSupabaseAnonKey()
  if (url && key) return { ok: true, url, key }
  if (!url && !key) return { ok: false, reason: 'missing_both' }
  if (!url) return { ok: false, reason: 'missing_url' }
  return { ok: false, reason: 'missing_key' }
}

export function getSupabasePublicEnv(): { url: string; key: string } {
  const s = getSupabaseEnvStatus()
  if (s.ok) return { url: s.url, key: s.key }
  return { url: BUILD_URL, key: BUILD_ANON }
}
