import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Vercel Edge 번들에 `@/lib/...` 를 넣지 않습니다 (인증은 `app/(dashboard)/layout` + `/api/auth/login`).
 * 예전에 미들웨어가 `public-env` 를 참조하던 빌드 캐시와 구분되도록, next 패키지만 사용하는 통과용입니다.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)'],
}
