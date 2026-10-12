import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { getSupabasePublicEnv } from '@/lib/supabase/supabasePublicEnv'

/** 한 요청(레이아웃 + 페이지) 안에서는 같은 클라이언트를 재사용 — 세션 해석을 한 번만 하도록 */
export const createClient = cache(async function createClient() {
  const { url, key } = getSupabasePublicEnv()
  const cookieStore = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch (e) {
          console.error('[supabase server] cookie set failed:', e)
        }
      },
    },
  })
})
