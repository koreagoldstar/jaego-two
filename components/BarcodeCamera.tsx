'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType, type Exception, type Result } from '@zxing/library'
import { Loader2 } from 'lucide-react'

type Props = {
  /** 카메라가 읽은 원문 (중복·쿨다운은 내부 처리) */
  onDecode: (text: string) => void | Promise<void>
  /** 하단 상태 문구 커스터마이즈 */
  initialStatus?: string
  className?: string
  videoClassName?: string
}

function buildScannerHints(): Map<DecodeHintType, unknown> {
  const hints = new Map<DecodeHintType, unknown>()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.AZTEC,
    BarcodeFormat.PDF_417,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.CODABAR,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.ITF,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ])
  hints.set(DecodeHintType.TRY_HARDER, true)
  return hints
}

export function BarcodeCamera({
  onDecode,
  initialStatus = '카메라 시작 중…',
  className = '',
  videoClassName = 'w-full max-h-[min(42vh,320px)] object-contain bg-black',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastAt = useRef(0)
  const lastText = useRef('')
  const onDecodeRef = useRef(onDecode)
  const [status, setStatus] = useState(initialStatus)

  onDecodeRef.current = onDecode

  useEffect(() => {
    const reader = new BrowserMultiFormatReader(buildScannerHints(), {
      delayBetweenScanAttempts: 80,
      delayBetweenScanSuccess: 350,
      tryPlayVideoTimeout: 12_000,
    })
    let cancelled = false
    let controls: { stop: () => void } | undefined
    let attachedVideo: HTMLVideoElement | null = null

    const pickBackDeviceId = async () => {
      let envDeviceId: string | undefined
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        const track = stream.getVideoTracks()[0]
        envDeviceId = track?.getSettings().deviceId
        stream.getTracks().forEach(t => t.stop())
      } catch {
        /* fallback below */
      }

      if (envDeviceId) return envDeviceId

      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      const scored = devices
        .map(d => {
          const label = d.label.toLowerCase()
          let score = 0
          if (/back|rear|environment|후면|뒤/i.test(label)) score += 100
          if (/front|user|facetime|전면|앞/i.test(label)) score -= 100
          return { id: d.deviceId, score }
        })
        .sort((a, b) => b.score - a.score)

      return scored[0]?.id
    }

    const startDecode = async () => {
      const videoEl = videoRef.current
      if (!videoEl || cancelled) return
      attachedVideo = videoEl

      const onResult = (result: Result | undefined, _err: Exception | undefined) => {
        if (cancelled) return
        /* 연속 스캔은 실패 프레임마다 NotFound 등이 올 수 있음 — 성공 시에만 result 가 있다 */
        if (!result) return
        const text = result.getText().trim()
        if (!text) return
        const now = Date.now()
        if (text === lastText.current && now - lastAt.current < 2500) return
        lastText.current = text
        lastAt.current = now
        void Promise.resolve(onDecodeRef.current(text)).catch(() => {})
      }

      const constraintAttempts: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920, min: 480 },
            height: { ideal: 1080, min: 360 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        },
        {
          video: {
            facingMode: 'environment',
            width: { min: 640 },
            height: { min: 480 },
          },
          audio: false,
        },
        { video: { facingMode: 'environment' }, audio: false },
      ]

      for (const constraints of constraintAttempts) {
        try {
          controls = await reader.decodeFromConstraints(constraints, videoEl, (result, error, _c) => {
            onResult(result, error)
          })
          setStatus('바코드·QR을 비추세요')
          return
        } catch {
          /* try next constraints */
        }
      }

      try {
        const back = await pickBackDeviceId()
        controls = await reader.decodeFromVideoDevice(back, videoEl, (result, error, _c) => {
          onResult(result, error)
        })
        setStatus('바코드·QR을 비추세요')
      } catch {
        setStatus('카메라를 사용할 수 없습니다. 권한·HTTPS를 확인하세요.')
      }
    }

    void startDecode()

    return () => {
      cancelled = true
      controls?.stop()
      if (attachedVideo) BrowserCodeReader.cleanVideoSource(attachedVideo)
    }
  }, [])

  return (
    <div className={`rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-lg ${className}`}>
      <video ref={videoRef} className={videoClassName} playsInline muted autoPlay />
      <div className="bg-slate-900 text-slate-200 text-sm px-4 py-3 flex items-center gap-2 min-h-[3rem]">
        {status.includes('비추') && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        <span className="break-all">{status}</span>
      </div>
    </div>
  )
}
