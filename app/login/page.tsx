import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSupabaseEnvStatus } from '@/lib/supabase/supabasePublicEnv'
import { createClient } from '@/lib/supabase/server'
import { APP_NAME, SAAS_MODE } from '@/lib/saas/mode'
import { LogoMark } from '@/components/site/Logo'

export const dynamic = 'force-dynamic'

function readParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const raw = searchParams[key]
  const s = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined
  if (!s) return undefined
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    redirect('/dashboard')
  }

  const error = readParam(searchParams, 'error')
  const notice = readParam(searchParams, 'notice')
  const env = getSupabaseEnvStatus()

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center mb-8">
          {SAAS_MODE ? (
            <LogoMark className="mx-auto mb-4 h-16 w-16" />
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-sm">
              <span className="text-2xl" aria-hidden>
                📦
              </span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900">{APP_NAME}</h1>
          <p className="text-slate-500 text-sm mt-1">{SAAS_MODE ? '회사 계정으로 로그인' : '재고관리'}</p>
        </Link>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          {!env.ok && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 space-y-1">
              <strong className="block">Supabase 연결 설정이 불완전합니다</strong>
              {env.reason === 'missing_both' && (
                <span className="block text-amber-800">
                  프로젝트 루트에 <code className="text-xs bg-amber-100 px-1">.env.local</code> 파일을 만들고{' '}
                  <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> 과{' '}
                  <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> 를{' '}
                  <strong>둘 다</strong> 넣으세요. 한쪽만 있으면 앱이 가짜 주소로 붙어 로그인에 실패합니다.
                </span>
              )}
              {env.reason === 'missing_url' && (
                <span className="block text-amber-800">
                  <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> 이 비어 있습니다. Supabase →
                  Settings → API 의 Project URL 을 넣으세요.
                </span>
              )}
              {env.reason === 'missing_key' && (
                <span className="block text-amber-800">
                  <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> 가 비어 있습니다. Settings →
                  API 의 anon public 키 전체를 넣으세요.
                </span>
              )}
              {process.env.VERCEL ? (
                <span className="block text-xs text-amber-700 mt-2 space-y-1">
                  <strong className="block">Vercel 배포인 경우</strong>
                  1) Dashboard → 이 프로젝트 → <strong>Settings → Environment Variables</strong>
                  <br />
                  2) 이름이 정확히{' '}
                  <code className="bg-amber-100 px-1 text-[11px]">NEXT_PUBLIC_SUPABASE_URL</code>,{' '}
                  <code className="bg-amber-100 px-1 text-[11px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> 인지 확인 (앞에{' '}
                  <code className="text-[11px]">NEXT_PUBLIC_</code> 필수)
                  <br />
                  3) <strong>Production</strong> (그리고 미리보기 URL을 쓰면 Preview도)에 체크되어 있는지 확인
                  <br />
                  4) 저장 후 <strong>Deployments → Redeploy</strong> (환경 변수는 새 빌드에 반영됩니다)
                  <br />
                  <span className="text-amber-800/90">
                    또는 서버 전용으로 <code className="text-[11px]">SUPABASE_URL</code>,{' '}
                    <code className="text-[11px]">SUPABASE_ANON_KEY</code> 만 넣어도 됩니다. (브라우저용 클라이언트까지 쓰려면{' '}
                    <code className="text-[11px]">NEXT_PUBLIC_*</code> 도 필요합니다)
                  </span>
                </span>
              ) : (
                <span className="block text-xs text-amber-700 mt-2">
                  저장 후 반드시 <code className="bg-amber-100 px-1">npm run dev</code> 를 끄고 다시 실행하세요.
                </span>
              )}
            </p>
          )}

          <form action="/api/auth/login" method="POST" className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm text-slate-600 mb-1">
                이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="off"
                defaultValue=""
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                placeholder="이메일을 입력하세요"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm text-slate-600 mb-1">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                placeholder="••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {notice && (
              <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100">
                {notice}
              </p>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 whitespace-pre-wrap border border-red-100">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3.5 rounded-xl transition-colors shadow-sm"
            >
              들어가기
            </button>
          </form>

          {SAAS_MODE && (
            <p className="text-sm text-slate-500 text-center mt-5">
              아직 계정이 없으신가요?{' '}
              <Link href="/signup" className="text-blue-600 font-medium hover:underline">
                무료로 시작하기
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
