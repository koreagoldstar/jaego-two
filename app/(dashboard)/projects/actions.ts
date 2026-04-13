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
      item_id,
      planned_qty,
    },
    { onConflict: 'user_id,project_name,item_id' }
  )

  revalidatePath('/projects')
}
