'use client'

import { Share, X } from 'lucide-react'
import type { InstallPlatform } from '@/lib/pwa/platform'

type Props = {
  platform: Exclude<InstallPlatform, 'standalone'>
  onClose: () => void
}

export function InstallGuideModal({ platform, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-guide-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 id="install-guide-title" className="font-semibold text-slate-900">
            {platform === 'ios' ? '홈 화면에 추가' : '앱 설치 방법'}
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {platform === 'ios' ? (
            <>
              <p className="text-sm text-slate-600">
                iPhone은 Safari에서 아래 순서대로 누르면 앱처럼 설치됩니다.
              </p>
              <ol className="text-sm text-slate-800 space-y-3">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    1
                  </span>
                  <span>
                    Safari 하단 <Share className="w-4 h-4 inline -mt-0.5" aria-hidden />{' '}
                    <strong>공유</strong> 버튼
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    2
                  </span>
                  <span>
                    <strong>홈 화면에 추가</strong> 선택
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    3
                  </span>
                  <span>
                    <strong>추가</strong> → 홈 화면 아이콘으로 실행
                  </span>
                </li>
              </ol>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Chrome 등 다른 브라우저에서는 설치가 안 됩니다. <strong>Safari</strong>로 열어 주세요.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                자동 설치 창이 뜨지 않으면 Chrome에서 아래 방법을 사용하세요.
              </p>
              <ol className="text-sm text-slate-800 space-y-3">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    1
                  </span>
                  <span>
                    Chrome 오른쪽 위 <strong>⋮</strong> 메뉴
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    2
                  </span>
                  <span>
                    <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    3
                  </span>
                  <span>설치 완료 후 홈 화면 아이콘 실행</span>
                </li>
              </ol>
            </>
          )}
        </div>

        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
