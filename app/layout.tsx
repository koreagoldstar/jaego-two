// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { PwaRegister } from '@/components/PwaRegister'
import { InstallAppBanner } from '@/components/InstallAppBanner'
import { APP_NAME, SAAS_MODE } from '@/lib/saas/mode'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: SAAS_MODE
    ? { default: '오늘의 재고 — 바코드 한 번으로 끝나는 재고관리', template: '%s | 오늘의 재고' }
    : APP_NAME,
  description: SAAS_MODE
    ? '품목 등록부터 입출고, 바코드·QR 라벨, 프로젝트별 자재 관리까지. 휴대폰 하나로 쓰는 현장형 재고관리 서비스.'
    : '재고관리',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={inter.className}>
        <PwaRegister />
        <InstallAppBanner />
        {children}
      </body>
    </html>
  )
}
