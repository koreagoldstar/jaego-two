'use server'

import { revalidateInventoryViews } from '@/lib/projects/revalidateViews'
import { createClient } from '@/lib/supabase/server'

function revalidateProjectViews() {
  revalidateInventoryViews()
}

export async function renameProjectAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const old_name = String(formData.get('old_name') ?? '').trim()
  const new_name = String(formData.get('new_name') ?? '').trim()

  if (!old_name) return { ok: false as const, error: '기존 프로젝트명이 없습니다' }
  if (!new_name) return { ok: false as const, error: '새 프로젝트명을 입력하세요' }
  if (old_name === new_name) return { ok: true as const }

  const [planHit, txHit, statusHit] = await Promise.all([
    supabase
      .from('project_usage_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('project_name', new_name)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('stock_transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('project', new_name)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('project_status')
      .select('project_name')
      .eq('user_id', user.id)
      .eq('project_name', new_name)
      .maybeSingle(),
  ])

  if (planHit.error && !planHit.error.message.toLowerCase().includes('project_usage_plans')) {
    return { ok: false as const, error: planHit.error.message }
  }
  if (txHit.error) return { ok: false as const, error: txHit.error.message }
  if (statusHit.error && !statusHit.error.message.toLowerCase().includes('project_status')) {
    return { ok: false as const, error: statusHit.error.message }
  }

  if (planHit.data || txHit.data || statusHit.data) {
    return { ok: false as const, error: '이미 사용 중인 프로젝트명입니다. 다른 이름을 입력하세요.' }
  }

  const { data: oldStatus } = await supabase
    .from('project_status')
    .select('completed_at')
    .eq('user_id', user.id)
    .eq('project_name', old_name)
    .maybeSingle()

  const { error: planError } = await supabase
    .from('project_usage_plans')
    .update({ project_name: new_name })
    .eq('user_id', user.id)
    .eq('project_name', old_name)
  if (planError) return { ok: false as const, error: planError.message }

  const { error: txError } = await supabase
    .from('stock_transactions')
    .update({ project: new_name })
    .eq('user_id', user.id)
    .eq('project', old_name)
  if (txError) return { ok: false as const, error: txError.message }

  if (oldStatus) {
    const { error: delStatusError } = await supabase
      .from('project_status')
      .delete()
      .eq('user_id', user.id)
      .eq('project_name', old_name)
    if (delStatusError && !delStatusError.message.toLowerCase().includes('project_status')) {
      return { ok: false as const, error: delStatusError.message }
    }
    if (!delStatusError) {
      const { error: insStatusError } = await supabase.from('project_status').upsert(
        {
          user_id: user.id,
          project_name: new_name,
          completed_at: oldStatus.completed_at,
        },
        { onConflict: 'user_id,project_name' },
      )
      if (insStatusError) return { ok: false as const, error: insStatusError.message }
    }
  }

  revalidateProjectViews()
  return { ok: true as const }
}

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
    revalidateProjectViews()
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
    { onConflict: 'user_id,project_name,item_id' },
  )

  revalidateProjectViews()
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
      { onConflict: 'user_id,project_name,item_id' },
    )
  }

  revalidateProjectViews()
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

  revalidateProjectViews()
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
      { onConflict: 'user_id,project_name,item_id' },
    )
  }

  revalidateProjectViews()
}

export async function completeProjectAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const project_name = String(formData.get('project_name') ?? '').trim()
  if (!project_name) return

  await supabase.from('project_status').upsert(
    {
      user_id: user.id,
      project_name,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,project_name' },
  )

  revalidateProjectViews()
}

export async function reopenProjectAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const project_name = String(formData.get('project_name') ?? '').trim()
  if (!project_name) return

  await supabase.from('project_status').delete().eq('user_id', user.id).eq('project_name', project_name)

  revalidateProjectViews()
}
