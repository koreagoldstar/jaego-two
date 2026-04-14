'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType, type Result } from '@zxing/library'
import { Loader2 } from 'lucide-react'

/** 업스케일 캔버스 한 변 최대(px). 작은 인쇄물 인식을 위해 프레임을 확대해 디코딩한다. */
const UPSCALE_CANVAS_MAX = 2560
const UPSCALE_MIN = 1.5
const UPSCALE_MAX = 2.5
/** 캔버스 디코딩 시도 간격(ms). 너무 짧으면 CPU 부담 */
const DECODE_INTERVAL_MS = 90

function computeDecodeScale(videoWidth: number, videoHeight: number): number {
  const m = Math.max(videoWidth, videoHeight)
  if (m <= 0) return 1.5
  let scale = Math.min(UPSCALE_MAX, UPSCALE_CANVAS_MAX / m)
  scale = Math.max(scale, UPSCALE_MIN)
  const tw = videoWidth * scale
  const th = videoHeight * scale
  if (tw > UPSCALE_CANVAS_MAX || th > UPSCALE_CANVAS_MAX) {
    scale = UPSCALE_CANVAS_MAX / m
  }
  return scale
}

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
    let attachedVideo: HTMLVideoElement | null = null
    let stream: MediaStream | null = null
    let decodeTimer: ReturnType<typeof setInterval> | undefined
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const pickBackDeviceId = async () => {
      let envDeviceId: string | undefined
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        const track = s.getVideoTracks()[0]
        envDeviceId = track?.getSettings().deviceId
        s.getTracks().forEach(t => t.stop())
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

    const tryPlayVideoWithTimeout = (videoEl: HTMLVideoElement) =>
      Promise.race([
        BrowserCodeReader.tryPlayVideo(videoEl),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('tryPlayVideo timeout')), 12_000),
        ),
      ])

    const startDecode = async () => {
      const videoEl = videoRef.current
      if (!videoEl || cancelled || !ctx) return
      attachedVideo = videoEl

      const onResult = (result: Result | undefined) => {
        if (cancelled) return
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
            width: { ideal: 1920, min: 720 },
            height: { ideal: 1080, min: 540 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        },
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
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

      const startCanvasLoop = () => {
        let frameToggle = false
        decodeTimer = setInterval(() => {
          if (cancelled || !stream) return
          const vw = videoEl.videoWidth
          const vh = videoEl.videoHeight
          if (!vw || !vh) return

          frameToggle = !frameToggle
          const scale = computeDecodeScale(vw, vh)
          canvas.width = Math.round(vw * scale)
          canvas.height = Math.round(vh * scale)
          ctx.imageSmoothingEnabled = false

          if (frameToggle) {
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
          } else {
            /* 화면 중앙에 작은 라벨을 두는 경우가 많아, 화면 중앙 55%만 잘라 확대해 디코딩 */
            const cx = vw * 0.225
            const cy = vh * 0.225
            const cw = vw * 0.55
            const ch = vh * 0.55
            ctx.drawImage(videoEl, cx, cy, cw, ch, 0, 0, canvas.width, canvas.height)
          }

          try {
            const result = reader.decodeFromCanvas(canvas)
            onResult(result)
          } catch {
            /* NotFound 등 */
          }
        }, DECODE_INTERVAL_MS)
      }

      for (const constraints of constraintAttempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints)
          break
        } catch {
          stream = null
        }
      }

      if (!stream) {
        try {
          const back = await pickBackDeviceId()
          if (!back) throw new Error('no device')
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: back },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          })
        } catch {
          setStatus('카메라를 사용할 수 없습니다. 권한·HTTPS를 확인하세요.')
          return
        }
      }

      BrowserCodeReader.addVideoSource(videoEl, stream)
      try {
        await tryPlayVideoWithTimeout(videoEl)
      } catch {
        setStatus('카메라 영상을 시작하지 못했습니다.')
        stream.getTracks().forEach(t => t.stop())
        stream = null
        BrowserCodeReader.cleanVideoSource(videoEl)
        return
      }

      setStatus('작은 라벨은 가까이 비추세요 · 초점이 맞도록')

      startCanvasLoop()
    }

    void startDecode()

    return () => {
      cancelled = true
      if (decodeTimer !== undefined) clearInterval(decodeTimer)
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
        stream = null
      }
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
