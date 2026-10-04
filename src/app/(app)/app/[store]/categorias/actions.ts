'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/session'
import { readCategoryForm } from '@/lib/structure'

const back = (slug: string, key: 'ok' | 'erro', code: string): never => redirect(`/app/${slug}/categorias?${key}=${code}`)

function errorCode(error: { code?: string; message?: string }): string {
  const m = error.message ?? ''
  if (m.includes('depth_exceeded')) return 'depth'
  if (m.includes('has_children')) return 'children'
  if (error.code === '42501') return 'forbidden'
  if (error.code === '23503') return 'invalid'
  if (m.includes('not_found') || error.code === 'P0002') return 'not_found'
  return 'generic'
}

export async function saveCategoryAction(storeId: string, slug: string, categoryId: string | null, fd: FormData) {
  await requireUser()
  const parsed = readCategoryForm(fd)
  if (!parsed.ok) return back(slug, 'erro', 'invalid')
  const supabase = await createClient()
  const { error } = await supabase.rpc('save_category', { p_store: storeId, p_id: categoryId, p: parsed.payload })
  if (error) return back(slug, 'erro', errorCode(error))
  revalidatePath(`/app/${slug}`, 'layout')
  return back(slug, 'ok', categoryId ? 'saved' : 'created')
}

export async function deleteCategoryAction(slug: string, categoryId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.from('categories').delete().eq('id', categoryId).select('id')
  if (error) return back(slug, 'erro', errorCode(error))
  if (!data?.length) return back(slug, 'erro', 'forbidden')
  revalidatePath(`/app/${slug}`, 'layout')
  return back(slug, 'ok', 'deleted')
}
