'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { inviteErrorCode, isInviteToken } from '@/lib/invites'

/** Aceita o convite. Sem login, volta ao login e depois ao mesmo convite. */
export async function acceptInviteAction(token: string) {
  if (!isInviteToken(token)) redirect('/')
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect(`/entrar?next=${encodeURIComponent(`/convite/${token}`)}`)

  const { data, error } = await supabase.rpc('accept_invite', { p_token: token })
  if (error) redirect(`/convite/${token}?erro=${inviteErrorCode(error)}`)
  redirect(`/app/${(data as { slug: string }).slug}`)
}
