'use server'

import { createClient } from '@/lib/supabase/server'
import { generateBarcodeValue } from '@/lib/items/codeGeneratorsServer'
import { isMissingItemStockLotsTable } from '@/lib/supabase/missingTable'
import { redirect } from 'next/navigation'

/** 입출고 이력 보조 테이블 — 실패해도 품목 등록 자체는 성공시키고 서버 로그만 남김 (throw 시 Digest 오류 페이지로 이어짐) */
async function logInventoryEvents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: Array<{
    user_id: string
    item_id?: string | null
    event_type: 'item_create' | 'item_delete'
    item_name: string
    quantity: number
    detail?: string | null
  }>
) {
  if (rows.length === 0) return
  const { error } = await supabase.from('inventory_events').insert(
    rows.map(r => ({
      user_id: r.user_id,
      item_id: r.item_id ?? null,
      event_type: r.event_type,
      item_name: r.item_name,
      quantity: r.quantity,
      detail: r.detail ?? '',
    }))
  )
  if (error) {
    const msg = error.message ?? String(error)
    if (msg.toLowerCase().includes('relation "inventory_events" does not exist')) return
    console.error('[inventory_events] insert skipped:', msg)
  }
}

export async function createItemAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = String(formData.get('name') ?? '').trim()
  if (!name) redirect('/items/new?error=' + encodeURIComponent('이름을 입력하세요'))

  const barcode_code = String(formData.get('barcode_code') ?? '').trim()
  const resolvedBarcode = barcode_code || generateBarcodeValue()
  const quantity = Math.max(0, parseInt(String(formData.get('quantity') ?? '0'), 10) || 0)
  const location = String(formData.get('location') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  const { data: inserted, error } = await supabase
    .from('items')
    .insert({
      user_id: user.id,
      name,
      sh: null,
      barcode_code: resolvedBarcode,
      serial_number: null,
      quantity: 0,
      location: location || null,
      description: description || '',
    })
    .select('id, created_at')
    .single()

  if (error) {
    redirect('/items/new?error=' + encodeURIComponent(error.message))
  }

  if (quantity > 0 && inserted?.id) {
    const { error: lotErr } = await supabase.from('item_stock_lots').insert({
      user_id: user.id,
      item_id: inserted.id,
      quantity,
      lot_code: resolvedBarcode,
      note: '',
      created_at: inserted.created_at,
    })
    if (lotErr) {
      if (isMissingItemStockLotsTable(lotErr)) {
        const { error: upErr } = await supabase
          .from('items')
          .update({ quantity })
          .eq('id', inserted.id)
          .eq('user_id', user.id)
        if (upErr) {
          redirect('/items/new?error=' + encodeURIComponent(upErr.message))
        }
      } else {
        redirect('/items/new?error=' + encodeURIComponent(lotErr.message))
      }
    }
  }

  await logInventoryEvents(supabase, [
    {
      user_id: user.id,
      item_id: inserted?.id ?? null,
      event_type: 'item_create',
      item_name: name,
      quantity,
      detail: '품목 추가',
    },
  ])
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

    rows.push({
      user_id: user.id,
      name,
      sh: null,
      barcode_code: generateBarcodeValue(),
      serial_number: null,
      quantity: 0,
      location: location || null,
      description: description || '',
    })
  }

  const { data: createdRows, error } = await supabase
    .from('items')
    .insert(rows)
    .select('id, name, created_at, barcode_code')

  if (error) {
    redirect('/items/new?error=' + encodeURIComponent(error.message))
  }

  if (quantityEach > 0 && createdRows?.length) {
    const lotRows = createdRows.map(row => ({
      user_id: user.id,
      item_id: row.id,
      quantity: quantityEach,
      lot_code: (row.barcode_code ?? '').trim() || `lot-${row.id.slice(0, 8)}`,
      note: '',
      created_at: row.created_at,
    }))
    const { error: lotErr } = await supabase.from('item_stock_lots').insert(lotRows)
    if (lotErr) {
      if (isMissingItemStockLotsTable(lotErr)) {
        for (const row of createdRows ?? []) {
          await supabase
            .from('items')
            .update({ quantity: quantityEach })
            .eq('id', row.id)
            .eq('user_id', user.id)
        }
      } else {
        redirect('/items/new?error=' + encodeURIComponent(lotErr.message))
      }
    }
  }

  await logInventoryEvents(
    supabase,
    (createdRows ?? []).map(row => ({
      user_id: user.id,
      item_id: row.id,
      event_type: 'item_create' as const,
      item_name: row.name,
      quantity: quantityEach,
      detail: '일괄 품목 추가',
    }))
  )
  redirect('/items')
}
