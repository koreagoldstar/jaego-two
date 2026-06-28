'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Download, Share, Smartphone } from 'lucide-react'
import { getInstallPlatform, isStandaloneMode, type InstallPlatform } from '@/lib/pwa/platform'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function platformLabel(platform: InstallPlatform): string {
  switch (platform) {
    case 'ios':
      return 'iPhone / iPad'
    case 'android':
      return 'Android'
    case 'standalone':
      return '설치됨'
    default:
      return 'PC 브라우저'
  }
}

export function InstallAppCard() {
  const [platform, setPlatform] = useState<InstallPlatform>('desktop')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    setPlatform(getInstallPlatform())
    setInstalled(isStandaloneMode())

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
      setDeferredPrompt(null)
    } finally {
      setInstalling(false)
    }
  }, [deferredPrompt])

  if (installed || platform === 'standalone') {
    return (
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-emerald-900">앱으로 설치되어 있습니다</p>
          <p className="text-sm text-emerald-800/80 mt-1">
            홈 화면 아이콘에서 실행 중이거나, 브라우저 없이 전체 화면으로 열리고 있습니다.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-4 border-b border-slate-100 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-900">휴대폰에 앱 설치</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            앱스토어 없이 홈 화면에 추가해 회사 재고 앱처럼 사용할 수 있습니다.
          </p>
          <p className="text-xs text-slate-400 mt-2">감지된 기기: {platformLabel(platform)}</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {deferredPrompt && (
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-3 rounded-xl transition-colors"
          >
            <Download className="w-5 h-5" />
            {installing ? '설치 중…' : '앱 설치하기'}
          </button>
        )}

        {platform === 'ios' && (
          <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside">
            <li>
              Safari 하단 <Share className="w-4 h-4 inline -mt-0.5" aria-hidden /> <strong>공유</strong> 버튼을
              누릅니다
            </li>
            <li>
              <strong>홈 화면에 추가</strong>를 선택합니다
            </li>
            <li>이름 확인 후 <strong>추가</strong>를 누륩니다</li>
          </ol>
        )}

        {platform === 'android' && !deferredPrompt && (
          <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside">
            <li>Chrome 메뉴(⋮) → <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong></li>
            <li>안내에 따라 설치를 완료합니다</li>
            <li>설치 후 홈 화면 아이콘으로 실행하세요</li>
          </ol>
        )}

        {platform === 'desktop' && (
          <p className="text-sm text-slate-600">
            PC Chrome 주소창 오른쪽의 <strong>설치</strong> 아이콘을 누르거나, 메뉴 →{' '}
            <strong>앱 설치</strong>를 선택하세요. 현장 작업은 휴대폰 설치를 권장합니다.
          </p>
        )}

        <p className="text-xs text-slate-400">
          로그인은 한 번만 하면 됩니다. 설치 후에도 같은 계정으로 자동 로그인됩니다.
        </p>
      </div>
    </div>
  )
}
