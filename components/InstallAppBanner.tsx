'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Download, X } from 'lucide-react'
import { DISMISS_KEY, shouldShowInstallBanner } from '@/lib/pwa/platform'
import { usePwaInstall } from '@/lib/pwa/usePwaInstall'

export function InstallAppBanner() {
  const pathname = usePathname()
  const { canNativeInstall, installing, install } = usePwaInstall()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const update = () => setVisible(shouldShowInstallBanner())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  const handleInstall = async () => {
    const result = await install()
    if (result === 'accepted') dismiss()
    else if (result === 'manual') {
      window.location.href = '/settings'
    }
  }

  if (!visible) return null

  const hasBottomNav = pathname !== '/login' && !pathname.startsWith('/move-app')
  const bottomClass = hasBottomNav
    ? 'bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))]'
    : 'bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]'

  return (
    <div className={`fixed ${bottomClass} left-0 right-0 z-40 px-4 pointer-events-none`}>
      <div className="max-w-lg mx-auto pointer-events-auto rounded-2xl bg-slate-900 text-white shadow-lg border border-slate-700 p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">홈 화면에 앱 추가</p>
          <p className="text-xs text-slate-400 truncate">버튼 한 번으로 설치하세요</p>
        </div>
        {canNativeInstall ? (
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            className="shrink-0 flex items-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-medium px-3 py-2 rounded-lg"
          >
            <Download className="w-3.5 h-3.5" />
            {installing ? '…' : '설치'}
          </button>
        ) : (
          <Link
            href="/settings"
            className="shrink-0 text-xs font-medium text-blue-300 hover:text-blue-200 px-2 py-2"
          >
            설치하기
          </Link>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 p-1 text-slate-400 hover:text-white"
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
