'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export function ScanClient() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastAt = useRef(0)
  const lastText = useRef('')
  const router = useRouter()
  const [status, setStatus] = useState('카메라 시작 중…')

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let cancelled = false
    let controls: { stop: () => void } | undefined

    async function lookupAndGo(code: string) {
      setStatus(`인식: ${code}`)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('items')
        .select('id')
        .eq('user_id', user.id)
        .eq('barcode_code', code)
        .maybeSingle()

      if (data?.id) {
        router.push(`/move-app?item=${data.id}`)
        return
      }

      const { data: loose } = await supabase
        .from('items')
        .select('id')
        .eq('user_id', user.id)
        .ilike('barcode_code', `%${code}%`)
        .limit(1)
        .maybeSingle()

      if (loose?.id) {
        router.push(`/move-app?item=${loose.id}`)
        return
      }

      setStatus(`등록되지 않은 코드: ${code}`)
    }

    ;(async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        const back =
          devices.find(d => /back|rear|environment/i.test(d.label))?.deviceId ?? devices[0]?.deviceId
        const el = videoRef.current
        if (!el || cancelled) return

        controls = await reader.decodeFromVideoDevice(back, el, result => {
          if (!result || cancelled) return
          const text = result.getText().trim()
          if (!text) return
          const now = Date.now()
          if (text === lastText.current && now - lastAt.current < 2500) return
          lastText.current = text
          lastAt.current = now
          void lookupAndGo(text)
        })
        setStatus('스캔 중 — 바코드를 비추세요')
      } catch {
        setStatus('카메라를 사용할 수 없습니다. 브라우저 권한을 확인하세요.')
      }
    })()

    return () => {
      cancelled = true
      controls?.stop()
      const el = videoRef.current
      if (el) {
        BrowserCodeReader.cleanVideoSource(el)
      }
    }
  }, [router])

  return (
    <div className="rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-lg">
      <video ref={videoRef} className="w-full max-h-[50vh] object-cover" playsInline muted />
      <div className="bg-slate-900 text-slate-200 text-sm px-4 py-3 flex items-center gap-2">
        {status.includes('스캔') && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        <span className="break-all">{status}</span>
      </div>
    </div>
  )
}
