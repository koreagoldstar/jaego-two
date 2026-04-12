'use server'

import { createClient } from '@/lib/supabase/server'
import { generateBarcodeValue, generateSerialValue } from '@/lib/items/codeGeneratorsServer'
import { redirect } from 'next/navigation'

export async function createItemAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = String(formData.get('name') ?? '').trim()
  if (!name) redirect('/items/new?error=' + encodeURIComponent('이름을 입력하세요'))

  const sh = String(formData.get('sh') ?? '').trim()
  const barcode_code = String(formData.get('barcode_code') ?? '').trim()
  const serial_number = String(formData.get('serial_number') ?? '').trim()
  const quantity = Math.max(0, parseInt(String(formData.get('quantity') ?? '0'), 10) || 0)
  const location = String(formData.get('location') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  const { error } = await supabase.from('items').insert({
    user_id: user.id,
    name,
    sh: sh || null,
    barcode_code: barcode_code || null,
    serial_number: serial_number || null,
    quantity,
    location: location || null,
    description: description || '',
  })

  if (error) {
    redirect('/items/new?error=' + encodeURIComponent(error.message))
  }
  redirect('/items')
}

const MAX_BATCH = 100

export async function createItemsBatchAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const prefix = String(formData.get('bulk_prefix') ?? '').trim()
  if (!prefix) {
    redirect('/items/new?error=' + encodeURIComponent('일괄 등록: 품목 이름(접두어)를 입력하세요'))
  }

  const count = Math.min(
    MAX_BATCH,
    Math.max(1, parseInt(String(formData.get('bulk_count') ?? '1'), 10) || 1)
  )
  const nameStyle = String(formData.get('bulk_name_style') ?? 'dash') === 'paren' ? 'paren' : 'dash'
  const autoBarcode = formData.get('bulk_auto_barcode') === 'on'
  const autoSerial = formData.get('bulk_auto_serial') === 'on'
  const shBase = String(formData.get('bulk_sh') ?? '').trim()
  const shAppendIndex = formData.get('bulk_sh_append_index') === 'on'
  const quantityEach = Math.max(0, parseInt(String(formData.get('bulk_quantity') ?? '0'), 10) || 0)
  const location = String(formData.get('bulk_location') ?? '').trim()
  const description = String(formData.get('bulk_description') ?? '').trim()

  const rows: Array<{
    user_id: string
    name: string
    sh: string | null
    barcode_code: string | null
    serial_number: string | null
    quantity: number
    location: string | null
    description: string
  }> = []

  for (let i = 1; i <= count; i++) {
    const name =
      nameStyle === 'paren' ? `${prefix} (${i})` : `${prefix}-${String(i).padStart(3, '0')}`

    let sh: string | null = null
    if (shBase) {
      sh = shAppendIndex ? `${shBase}-${String(i).padStart(3, '0')}` : shBase
    }

    rows.push({
      user_id: user.id,
      name,
      sh,
      barcode_code: autoBarcode ? generateBarcodeValue() : null,
      serial_number: autoSerial ? generateSerialValue() : null,
      quantity: quantityEach,
      location: location || null,
      description: description || '',
    })
  }

  const { error } = await supabase.from('items').insert(rows)

  if (error) {
    redirect('/items/new?error=' + encodeURIComponent(error.message))
  }
  redirect('/items')
}
