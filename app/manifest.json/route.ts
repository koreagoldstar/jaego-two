import { NextResponse } from 'next/server'
import { APP_NAME, SAAS_MODE } from '@/lib/saas/mode'

/** PWA 매니페스트 — 배포 모드(판매용/신화유디텍)에 따라 앱 이름이 달라서 라우트로 제공 */
export function GET() {
  const manifest = {
    name: APP_NAME,
    short_name: SAAS_MODE ? '오늘의 재고' : '신화유디텍',
    description: '재고관리 앱 — 품목, 입출고, 바코드 스캔',
    start_url: '/dashboard',
    scope: '/',
    id: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f5f6f8',
    theme_color: '#2563eb',
    lang: 'ko',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: '입·출고',
        short_name: '입출고',
        description: '현장 입고·출고',
        url: '/move-app',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: '바코드 스캔',
        short_name: '스캔',
        description: '카메라로 바코드 스캔',
        url: '/scan',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  }
  return NextResponse.json(manifest, {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  })
}
