'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/session'
import { dbErrorMessage } from '@/lib/errors'
import { isValidBrandingPath, type BrandingKind } from '@/lib/images'
import { readStoreSettings } from '@/lib/storeSettings'
import { readCatalogFilters, suggestedCategoryItems } from '@/lib/catalogFilters'
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

/** Salva quais filtros a cliente vê no catálogo e quais públicos/estilos a loja usa. Só o dono. */
export async function updateCatalogFiltersAction(storeId: string, slug: string, _: FormState, fd: FormData): Promise<FormState> {
  await requireUser()
  if (!UUID.test(storeId)) return { error: 'Loja inválida.' }
  const parsed = readCatalogFilters(fd)
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const { data, error } = await supabase.from('stores').update({ catalog_filters: parsed.filters }).eq('id', storeId).select('id')
  if (error) return { error: dbErrorMessage(error) }
  if (!data?.length) return { error: 'Só o dono da loja pode alterar os filtros (e a loja precisa estar ativa).' }
  revalidatePath(`/app/${slug}`, 'layout')
  revalidatePath(`/${slug}`, 'layout')
  return { message: 'Filtros salvos. O catálogo público já usa a nova seleção.' }
}

/** Cria as categorias sugeridas (blusas, calças, acessórios…) que a loja ainda não tem. */
export async function addSuggestedCategoriesAction(storeId: string, slug: string, _: FormState, fd: FormData): Promise<FormState> {
  await requireUser()
  if (!UUID.test(storeId)) return { error: 'Loja inválida.' }
  const items = suggestedCategoryItems(String(fd.get('preset') ?? ''))
  if (!items.length) return { error: 'Escolha um tipo de loja.' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('add_categories', { p_store: storeId, p_items: items })
  if (error) return { error: dbErrorMessage(error) }
  revalidatePath(`/app/${slug}`, 'layout')
  revalidatePath(`/${slug}`, 'layout')
  const n = Number(data ?? 0)
  return { message: n === 0 ? 'Você já tem todas essas categorias.' : `${n} ${n === 1 ? 'categoria criada' : 'categorias criadas'}. Atribua-as às peças para elas aparecerem no catálogo.` }
}
