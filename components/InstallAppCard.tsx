'use client'

import { useState } from 'react'
import { CheckCircle2, Download, Smartphone } from 'lucide-react'
import { InstallGuideModal } from '@/components/InstallGuideModal'
import { usePwaInstall } from '@/lib/pwa/usePwaInstall'

function platformLabel(platform: string): string {
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
  const { platform, installed, canNativeInstall, installing, install } = usePwaInstall()
  const [guideOpen, setGuideOpen] = useState(false)

  const handleInstallClick = async () => {
    if (platform === 'ios' && !canNativeInstall) {
      setGuideOpen(true)
      return
    }

    const result = await install()
    if (result === 'manual' && platform !== 'standalone') {
      setGuideOpen(true)
    }
  }

  if (installed || platform === 'standalone') {
    return (
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-emerald-900">앱으로 설치되어 있습니다</p>
          <p className="text-sm text-emerald-800/80 mt-1">
            홈 화면 아이콘에서 실행 중입니다.
          </p>
        </div>
      </div>
    )
  }

  const showMobileInstall = platform === 'ios' || platform === 'android'

  return (
    <>
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">휴대폰에 앱 설치</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              버튼 한 번으로 홈 화면에 추가해 앱처럼 사용합니다.
            </p>
            <p className="text-xs text-slate-400 mt-2">감지된 기기: {platformLabel(platform)}</p>
          </div>
        </div>

        <div className="px-4 py-4 space-y-3">
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={installing}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-3.5 rounded-xl transition-colors shadow-sm"
          >
            <Download className="w-5 h-5" />
            {installing ? '설치 창 여는 중…' : '앱 설치하기'}
          </button>

          {canNativeInstall && showMobileInstall && (
            <p className="text-xs text-emerald-700 text-center">
              설치 준비 완료 — 버튼을 누르면 바로 설치됩니다.
            </p>
          )}

          {platform === 'ios' && !canNativeInstall && (
            <p className="text-xs text-slate-500 text-center">
              iPhone은 버튼 누른 뒤 Safari <strong>공유 → 홈 화면에 추가</strong>로 설치됩니다.
            </p>
          )}

          {platform === 'desktop' && (
            <p className="text-xs text-slate-500 text-center">
              PC Chrome에서는 버튼으로 설치 창이 뜨거나, 주소창 옆 설치 아이콘을 사용하세요.
            </p>
          )}

          <p className="text-xs text-slate-400">
            로그인은 한 번만 하면 됩니다. 설치 후에도 같은 계정으로 유지됩니다.
          </p>
        </div>
      </div>

      {guideOpen && (
        <InstallGuideModal platform={platform === 'desktop' ? 'android' : platform} onClose={() => setGuideOpen(false)} />
      )}
    </>
  )
}
