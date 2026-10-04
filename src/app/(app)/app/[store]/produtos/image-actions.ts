'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/session'
import { dbErrorMessage } from '@/lib/errors'
import { isImageKind, isValidImagePath, thumbPath } from '@/lib/images'

export type ActionResult = { error?: string; ok?: true }

const refresh = (slug: string) => revalidatePath(`/app/${slug}`, 'layout')
const UUID = /^[0-9a-f-]{36}$/i

/** Registra uma foto que o navegador acabou de enviar ao Storage. */
export async function registerImageAction(
  storeId: string, slug: string, productId: string, path: string, kind: string, alt: string,
): Promise<ActionResult> {
  await requireUser()
  if (!UUID.test(storeId) || !UUID.test(productId) || !isValidImagePath(path, storeId, productId)) {
    return { error: 'Arquivo inválido.' }
  }
  if (!isImageKind(kind)) return { error: 'Tipo de foto inválido.' }

  const supabase = await createClient()
  const { error } = await supabase.from('product_images').insert({
    store_id: storeId, product_id: productId, path, kind, alt: alt.trim().slice(0, 140) || null,
  })
  if (error) return { error: dbErrorMessage(error) }
  refresh(slug)
  return { ok: true }
}

export async function reorderImagesAction(slug: string, productId: string, orderedIds: string[]): Promise<ActionResult> {
  await requireUser()
  if (!UUID.test(productId) || !orderedIds.every((i) => UUID.test(i))) return { error: 'Pedido inválido.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('reorder_product_images', { p_product: productId, p_ids: orderedIds })
  if (error) return { error: dbErrorMessage(error) }
  refresh(slug)
  return { ok: true }
}

export async function setImageKindAction(slug: string, imageId: string, kind: string): Promise<ActionResult> {
  await requireUser()
  if (!UUID.test(imageId) || !isImageKind(kind)) return { error: 'Pedido inválido.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('product_images').update({ kind }).eq('id', imageId).select('id')
  if (error) return { error: dbErrorMessage(error) }
  if (!data?.length) return { error: 'Você não tem permissão para fazer isso.' }
  refresh(slug)
  return { ok: true }
}

/** Remove o registro e, em seguida, os arquivos (foto e miniatura). */
export async function removeImageAction(slug: string, imageId: string): Promise<ActionResult> {
  await requireUser()
  if (!UUID.test(imageId)) return { error: 'Pedido inválido.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('product_images').delete().eq('id', imageId).select('path')
  if (error) return { error: dbErrorMessage(error) }
  if (!data?.length) return { error: 'Você não tem permissão para fazer isso.' }
  await supabase.storage.from('catalog').remove(data.flatMap((r) => [r.path, thumbPath(r.path)]))
  refresh(slug)
  return { ok: true }
}
