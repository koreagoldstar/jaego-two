'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, X } from 'lucide-react'
import { getInstallPlatform, isStandaloneMode } from '@/lib/pwa/platform'

const DISMISS_KEY = 'jaego-install-banner-dismissed'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallAppBanner() {
  const [visible, setVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandaloneMode()) return
    if (localStorage.getItem(DISMISS_KEY) === '1') return
    const platform = getInstallPlatform()
    if (platform === 'desktop') return
    setVisible(true)

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    dismiss()
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-40 px-4 md:hidden pointer-events-none">
      <div className="max-w-lg mx-auto pointer-events-auto rounded-2xl bg-slate-900 text-white shadow-lg border border-slate-700 p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">홈 화면에 앱 추가</p>
          <p className="text-xs text-slate-400 truncate">바코드 스캔·입출고를 앱처럼 사용하세요</p>
        </div>
        {deferredPrompt ? (
          <button
            type="button"
            onClick={install}
            className="shrink-0 flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-2 rounded-lg"
          >
            <Download className="w-3.5 h-3.5" />
            설치
          </button>
        ) : (
          <Link
            href="/settings"
            className="shrink-0 text-xs font-medium text-blue-300 hover:text-blue-200 px-2 py-2"
          >
            방법 보기
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
