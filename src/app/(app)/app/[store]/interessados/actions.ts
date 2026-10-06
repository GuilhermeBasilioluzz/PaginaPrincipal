'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/session'
import { isInterestStatus, readInterestForm } from '@/lib/interest'

const UUID = /^[0-9a-f-]{36}$/i
const back = (slug: string, key: 'ok' | 'erro', code: string, extra = ''): never => redirect(`/app/${slug}/interessados?${key}=${code}${extra}`)

function errorCode(error: { code?: string; message?: string }): string {
  const m = error.message ?? ''
  if (m.includes('invalid_name') || m.includes('invalid_contact')) return 'invalid'
  if (error.code === '42501') return 'forbidden'
  if (error.code === 'P0002' || m.includes('not_found')) return 'not_found'
  return 'generic'
}

export async function addInterestAction(slug: string, fd: FormData) {
  await requireUser()
  const parsed = readInterestForm(fd)
  if (!parsed.ok) return back(slug, 'erro', 'invalid', `&produto=${encodeURIComponent(String(fd.get('product') ?? '').slice(0, 40))}`)
  const p = parsed.payload
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('add_interest', {
    p_product: p.product, p_name: p.name, p_contact: p.contact, p_size: p.size || null, p_note: p.note || null,
  })
  if (error) return back(slug, 'erro', errorCode(error), `&produto=${p.product}`)
  revalidatePath(`/app/${slug}`, 'layout')
  return back(slug, 'ok', data === 'already' ? 'already' : 'created', `&produto=${p.product}`)
}

export async function setInterestStatusAction(slug: string, interestId: string, status: string) {
  await requireUser()
  if (!UUID.test(interestId) || !isInterestStatus(status)) return back(slug, 'erro', 'invalid')
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_interest_status', { p_id: interestId, p_status: status })
  if (error) return back(slug, 'erro', errorCode(error))
  revalidatePath(`/app/${slug}`, 'layout')
  return back(slug, 'ok', status)
}

/** Apagar a pessoa (pedido de exclusão de dados): só dono e gerente. */
export async function deleteInterestAction(slug: string, interestId: string) {
  await requireUser()
  if (!UUID.test(interestId)) return back(slug, 'erro', 'invalid')
  const supabase = await createClient()
  const { data, error } = await supabase.from('product_interests').delete().eq('id', interestId).select('id')
  if (error) return back(slug, 'erro', errorCode(error))
  if (!data?.length) return back(slug, 'erro', 'forbidden')
  revalidatePath(`/app/${slug}`, 'layout')
  return back(slug, 'ok', 'deleted')
}
