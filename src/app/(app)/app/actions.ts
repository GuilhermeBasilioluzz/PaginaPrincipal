'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/session'
import { authErrorMessage, dbErrorMessage } from '@/lib/errors'
import { addMemberSchema, firstError, newPasswordSchema, profileSchema, storeSchema } from '@/lib/validation'
import { isRole } from '@/lib/permissions'
import type { FormState } from '@/lib/types'

const field = (fd: FormData, name: string) => String(fd.get(name) ?? '')

export async function createStoreAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser()
  const parsed = storeSchema.safeParse({ name: field(fd, 'name'), slug: field(fd, 'slug') })
  if (!parsed.success) return { error: firstError(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_store', { p_name: parsed.data.name, p_slug: parsed.data.slug })
  if (error) return { error: dbErrorMessage(error) }
  redirect(`/app/${parsed.data.slug}`)
}

export async function updateProfileAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const parsed = profileSchema.safeParse({ fullName: field(fd, 'fullName') })
  if (!parsed.success) return { error: firstError(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ full_name: parsed.data.fullName }).eq('id', user.id)
  if (error) return { error: dbErrorMessage(error) }
  revalidatePath('/app', 'layout')
  return { message: 'Perfil atualizado.' }
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser()
  const parsed = newPasswordSchema.safeParse({ password: field(fd, 'password'), confirm: field(fd, 'confirm') })
  if (!parsed.success) return { error: firstError(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: authErrorMessage(error) }
  return { message: 'Senha alterada.' }
}

// ---- equipe: o resultado volta por um código curto na URL (nunca texto livre)
const back = (slug: string, key: 'ok' | 'erro', code: string): never => redirect(`/app/${slug}/equipe?${key}=${code}`)

function teamErrorCode(error: { code?: string; message?: string }): string {
  const m = error.message ?? ''
  if (m.includes('user_not_found')) return 'user_not_found'
  if (m.includes('already_member')) return 'already_member'
  if (m.includes('ao menos um dono')) return 'last_owner'
  if (error.code === '42501') return 'forbidden'
  return 'generic'
}

export async function addMemberAction(storeId: string, slug: string, fd: FormData) {
  await requireUser()
  const parsed = addMemberSchema.safeParse({ email: field(fd, 'email'), role: field(fd, 'role') })
  if (!parsed.success) return back(slug, 'erro', 'invalid')

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_member_by_email', {
    p_store: storeId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  })
  if (error) return back(slug, 'erro', teamErrorCode(error))
  revalidatePath(`/app/${slug}/equipe`)
  return back(slug, 'ok', 'added')
}

export async function changeRoleAction(storeId: string, slug: string, userId: string, fd: FormData) {
  await requireUser()
  const role = field(fd, 'role')
  if (!isRole(role)) return back(slug, 'erro', 'invalid')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('store_members')
    .update({ role })
    .eq('store_id', storeId)
    .eq('user_id', userId)
    .select('user_id')
  if (error) return back(slug, 'erro', teamErrorCode(error))
  if (!data?.length) return back(slug, 'erro', 'forbidden')
  revalidatePath(`/app/${slug}/equipe`)
  return back(slug, 'ok', 'role')
}

export async function removeMemberAction(storeId: string, slug: string, userId: string) {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('store_members')
    .delete()
    .eq('store_id', storeId)
    .eq('user_id', userId)
    .select('user_id')
  if (error) return back(slug, 'erro', teamErrorCode(error))
  if (!data?.length) return back(slug, 'erro', 'forbidden')
  if (userId === user.id) redirect('/app') // saiu da loja
  revalidatePath(`/app/${slug}/equipe`)
  return back(slug, 'ok', 'removed')
}
