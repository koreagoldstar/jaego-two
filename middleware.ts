import { NextResponse, type NextRequest } from 'next/server'

/**
 * Vercel Edge에서 @supabase/ssr createServerClient 가 "unsupported modules" 로 실패하는 경우가 있어,
 * 미들웨어는 Next만 사용하고 세션 쿠키 존재 여부로만 게이트합니다.
 * 실제 세션 검증·토큰 갱신은 페이지/Route Handler의 Supabase 클라이언트가 담당합니다.
 */
function hasSupabaseSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => {
    if (!c.value?.length) return false
    // sb-<projectRef>-auth-token 또는 sb-<ref>-auth-token.0 (청크)
    return c.name.startsWith('sb-') && c.name.includes('auth-token')
  })
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isLoginPage = path === '/login' || path.startsWith('/login/')
  const isAuthApi = path.startsWith('/api/auth/')

  const signedIn = hasSupabaseSessionCookie(request)

  if (!signedIn && !isLoginPage && !isAuthApi) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (signedIn && path === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)'],
}
