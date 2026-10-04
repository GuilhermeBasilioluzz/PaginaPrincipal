import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'
import { isRole } from './permissions'
import type { Membership, Store } from './types'

/** Usuário logado (validado no servidor do Supabase) ou redireciona para /entrar. */
export const requireUser = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/entrar')
  return data.user
})

export const getProfile = cache(async () => {
  const user = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('full_name, is_super_admin').eq('id', user.id).maybeSingle()
  return { id: user.id, email: user.email ?? '', fullName: data?.full_name ?? '', isSuperAdmin: !!data?.is_super_admin }
})

/** Lojas em que a pessoa trabalha, com o papel dela em cada uma (o RLS já filtra). */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from('store_members')
    .select('role, stores(id, slug, name, tagline, is_active, catalog_enabled)')
    .eq('user_id', user.id)
    .order('created_at')
  const rows = (data ?? []) as unknown as { role: string; stores: Store | null }[]
  return rows.flatMap((r) => (r.stores && isRole(r.role) ? [{ role: r.role, store: r.stores }] : []))
})

/** A loja do endereço, só se a pessoa for da equipe; senão null. */
export async function getMembership(slug: string): Promise<Membership | null> {
  const all = await getMemberships()
  return all.find((m) => m.store.slug === slug) ?? null
}
