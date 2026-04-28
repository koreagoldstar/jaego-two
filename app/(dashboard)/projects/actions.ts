'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function saveProjectPlanAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const project_name = String(formData.get('project_name') ?? '').trim()
  const install_date = String(formData.get('install_date') ?? '').trim()
  const item_id = String(formData.get('item_id') ?? '').trim()
  const planned_qty = Math.max(0, parseInt(String(formData.get('planned_qty') ?? '0'), 10) || 0)

  if (!project_name || !item_id) return

  if (planned_qty <= 0) {
    await supabase
      .from('project_usage_plans')
      .delete()
      .eq('user_id', user.id)
      .eq('project_name', project_name)
      .eq('item_id', item_id)
    revalidatePath('/projects')
    return
  }

  await supabase.from('project_usage_plans').upsert(
    {
      user_id: user.id,
      project_name,
      install_date: install_date || null,
      item_id,
      planned_qty,
    },
    { onConflict: 'user_id,project_name,item_id' }
  )

  revalidatePath('/projects')
  revalidatePath('/stock-overview')
}

export async function saveProjectPlanBatchAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const project_name = String(formData.get('project_name') ?? '').trim()
  const install_date = String(formData.get('install_date') ?? '').trim()
  const itemIds = formData.getAll('item_id').map(v => String(v ?? '').trim())
  const qtyValues = formData.getAll('planned_qty').map(v => Math.max(0, parseInt(String(v ?? '0'), 10) || 0))
  if (!project_name) return

  const pairs = itemIds
    .map((item_id, i) => ({ item_id, planned_qty: qtyValues[i] ?? 0 }))
    .filter(row => row.item_id)

  for (const row of pairs) {
    if (row.planned_qty <= 0) {
      await supabase
        .from('project_usage_plans')
        .delete()
        .eq('user_id', user.id)
        .eq('project_name', project_name)
        .eq('item_id', row.item_id)
      continue
    }
    await supabase.from('project_usage_plans').upsert(
      {
        user_id: user.id,
        project_name,
        install_date: install_date || null,
        item_id: row.item_id,
        planned_qty: row.planned_qty,
      },
      { onConflict: 'user_id,project_name,item_id' }
    )
  }

  revalidatePath('/projects')
  revalidatePath('/stock-overview')
}

export async function deleteProjectPlanAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const project_name = String(formData.get('project_name') ?? '').trim()
  const item_id = String(formData.get('item_id') ?? '').trim()
  if (!project_name || !item_id) return

  await supabase
    .from('project_usage_plans')
    .delete()
    .eq('user_id', user.id)
    .eq('project_name', project_name)
    .eq('item_id', item_id)

  revalidatePath('/projects')
  revalidatePath('/stock-overview')
}

export async function updateProjectPlanEntryAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const project_name = String(formData.get('project_name') ?? '').trim()
  const install_date = String(formData.get('install_date') ?? '').trim()
  const original_item_id = String(formData.get('original_item_id') ?? '').trim()
  const item_id = String(formData.get('item_id') ?? '').trim()
  const planned_qty = Math.max(0, parseInt(String(formData.get('planned_qty') ?? '0'), 10) || 0)

  if (!project_name || !original_item_id || !item_id) return

  if (original_item_id !== item_id) {
    await supabase
      .from('project_usage_plans')
      .delete()
      .eq('user_id', user.id)
      .eq('project_name', project_name)
      .eq('item_id', original_item_id)
  }

  if (planned_qty <= 0) {
    await supabase
      .from('project_usage_plans')
      .delete()
      .eq('user_id', user.id)
      .eq('project_name', project_name)
      .eq('item_id', item_id)
  } else {
    await supabase.from('project_usage_plans').upsert(
      {
        user_id: user.id,
        project_name,
        install_date: install_date || null,
        item_id,
        planned_qty,
      },
      { onConflict: 'user_id,project_name,item_id' }
    )
  }

  revalidatePath('/projects')
  revalidatePath('/stock-overview')
}
