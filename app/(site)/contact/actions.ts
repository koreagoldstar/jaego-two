'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const KINDS = ['general', 'custom', 'plan'] as const
type Kind = (typeof KINDS)[number]

export async function submitInquiryAction(formData: FormData) {
  const field = (k: string, max: number) => String(formData.get(k) ?? '').trim().slice(0, max)
  const kindRaw = field('kind', 20)
  const kind: Kind = (KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as Kind) : 'general'
  const back = (error: string) => redirect(`/contact?kind=${kind}&error=${encodeURIComponent(error)}`)

  // 스팸봇용 숨김 칸 — 채워져 있으면 조용히 성공 처리
  if (field('website', 200)) redirect('/contact?sent=1')

  const company_name = field('company_name', 100)
  const contact_name = field('contact_name', 50)
  const phone = field('phone', 30)
  const email = field('email', 200)
  const message = field('message', 5000)

  if (!company_name) back('회사명을 입력해 주세요.')
  if (!phone && !email) back('연락받으실 전화번호나 이메일을 입력해 주세요.')
  if (!message) back('문의 내용을 입력해 주세요.')

  const supabase = await createClient()
  const { error } = await supabase.from('inquiries').insert({
    kind,
    company_name,
    contact_name: contact_name || null,
    phone: phone || null,
    email: email || null,
    message,
  })
  if (error) {
    console.error('[inquiries] insert failed:', error.message)
    back('문의 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.')
  }

  redirect('/contact?sent=1')
}
