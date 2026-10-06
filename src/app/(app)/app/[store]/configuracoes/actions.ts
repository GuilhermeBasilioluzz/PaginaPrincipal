'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/session'
import { dbErrorMessage } from '@/lib/errors'
import { isValidBrandingPath, type BrandingKind } from '@/lib/images'
import { readStoreSettings } from '@/lib/storeSettings'
import type { FormState } from '@/lib/types'
import type { ActionResult } from '../produtos/image-actions'

const UUID = /^[0-9a-f-]{36}$/i

export async function updateStoreSettingsAction(storeId: string, slug: string, _: FormState, fd: FormData): Promise<FormState> {
  await requireUser()
  if (!UUID.test(storeId)) return { error: 'Loja inválida.' }
  const parsed = readStoreSettings(fd)
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const { data, error } = await supabase.from('stores').update(parsed.payload).eq('id', storeId).select('id')
  if (error) return { error: dbErrorMessage(error) }
  if (!data?.length) return { error: 'Só o dono da loja pode alterar as configurações (e a loja precisa estar ativa).' }
  revalidatePath(`/app/${slug}`, 'layout')
  revalidatePath(`/${slug}`, 'layout')
  return { message: 'Configurações salvas. O catálogo público já mostra as mudanças.' }
}

/** Troca (ou remove, com path nulo) o logo ou o banner. O arquivo antigo é apagado do Storage. */
export async function setBrandingAction(storeId: string, slug: string, kind: BrandingKind, path: string | null): Promise<ActionResult> {
  await requireUser()
  if (!UUID.test(storeId) || (kind !== 'logo' && kind !== 'banner')) return { error: 'Pedido inválido.' }
  if (path !== null && !isValidBrandingPath(path, storeId, kind)) return { error: 'Arquivo inválido.' }

  const column = kind === 'logo' ? 'logo_path' : 'banner_path'
  const supabase = await createClient()
  const { data: before } = await supabase.from('stores').select(column).eq('id', storeId).maybeSingle()
  const old = (before as Record<string, string | null> | null)?.[column] ?? null

  const { data, error } = await supabase.from('stores').update({ [column]: path }).eq('id', storeId).select('id')
  if (error) return { error: dbErrorMessage(error) }
  if (!data?.length) return { error: 'Só o dono da loja pode alterar a identidade visual.' }
  if (old && old !== path) await supabase.storage.from('catalog').remove([old])
  revalidatePath(`/app/${slug}`, 'layout')
  revalidatePath(`/${slug}`, 'layout')
  return { ok: true }
}
