'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser'
import { Loader2 } from 'lucide-react'

type Props = {
  /** 카메라가 읽은 원문 (중복·쿨다운은 내부 처리) */
  onDecode: (text: string) => void | Promise<void>
  /** 하단 상태 문구 커스터마이즈 */
  initialStatus?: string
  className?: string
  videoClassName?: string
}

export function BarcodeCamera({
  onDecode,
  initialStatus = '카메라 시작 중…',
  className = '',
  videoClassName = 'w-full max-h-[min(42vh,320px)] object-cover',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastAt = useRef(0)
  const lastText = useRef('')
  const onDecodeRef = useRef(onDecode)
  const [status, setStatus] = useState(initialStatus)

  onDecodeRef.current = onDecode

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let cancelled = false
    let controls: { stop: () => void } | undefined
    let attachedVideo: HTMLVideoElement | null = null

    ;(async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        const back =
          devices.find(d => /back|rear|environment/i.test(d.label))?.deviceId ?? devices[0]?.deviceId
        const videoEl = videoRef.current
        if (!videoEl || cancelled) return
        attachedVideo = videoEl

        controls = await reader.decodeFromVideoDevice(back, videoEl, result => {
          if (!result || cancelled) return
          const text = result.getText().trim()
          if (!text) return
          const now = Date.now()
          if (text === lastText.current && now - lastAt.current < 2500) return
          lastText.current = text
          lastAt.current = now
          void Promise.resolve(onDecodeRef.current(text)).catch(() => {})
        })
        setStatus('바코드를 비추세요')
      } catch {
        setStatus('카메라를 사용할 수 없습니다. 권한을 확인하세요.')
      }
    })()

    return () => {
      cancelled = true
      controls?.stop()
      if (attachedVideo) BrowserCodeReader.cleanVideoSource(attachedVideo)
    }
  }, [])

  return (
    <div className={`rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-lg ${className}`}>
      <video ref={videoRef} className={videoClassName} playsInline muted />
      <div className="bg-slate-900 text-slate-200 text-sm px-4 py-3 flex items-center gap-2 min-h-[3rem]">
        {status.includes('비추') && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        <span className="break-all">{status}</span>
      </div>
    </div>
  )
}
