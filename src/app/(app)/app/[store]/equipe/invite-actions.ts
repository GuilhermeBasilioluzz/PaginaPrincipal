'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/session'
import { inviteMessage, inviteUrl, readInviteForm } from '@/lib/invites'
import { siteUrl } from '@/lib/supabase/env'
import type { FormState } from '@/lib/types'

/** Cria o convite e devolve o link UMA vez (o banco só guarda o resumo do código). */
export async function createInviteAction(storeId: string, slug: string, storeName: string, _: FormState, fd: FormData): Promise<FormState> {
  await requireUser()
  const parsed = readInviteForm(fd)
  if (!parsed.ok) return { error: parsed.error }
  const { role, label, days, uses } = parsed.payload

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_invite', { p_store: storeId, p_role: role, p_label: label || null, p_days: days, p_max_uses: uses })
  if (error) return { error: error.code === '42501' ? 'Só o dono da loja pode convidar (e a loja precisa estar ativa).' : 'Não foi possível criar o convite. Tente novamente.' }

  revalidatePath(`/app/${slug}/equipe`)
  const link = inviteUrl(siteUrl(), String(data))
  return {
    message: 'Convite criado. Copie o link agora: por segurança, ele não aparece de novo.',
    link,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(inviteMessage(storeName, role, link, days))}`,
  }
}

export async function revokeInviteAction(slug: string, inviteId: string) {
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.rpc('revoke_invite', { p_id: inviteId })
  revalidatePath(`/app/${slug}/equipe`)
  return redirect(`/app/${slug}/equipe?${error ? 'erro=forbidden' : 'ok=revoked'}`)
}
