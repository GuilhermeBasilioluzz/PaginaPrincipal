'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/session'
import { readCollectionForm, readCollectionIds } from '@/lib/structure'

const list = (slug: string, key: 'ok' | 'erro', code: string): never => redirect(`/app/${slug}/colecoes?${key}=${code}`)
const item = (slug: string, id: string, key: 'ok' | 'erro', code: string): never => redirect(`/app/${slug}/colecoes/${id}?${key}=${code}`)
const UUID = /^[0-9a-f-]{36}$/i

function errorCode(error: { code?: string; message?: string }): string {
  const m = error.message ?? ''
  if (m.includes('automatic_collection')) return 'automatic'
  if (error.code === '42501') return 'forbidden'
  if (m.includes('not_found') || error.code === 'P0002') return 'not_found'
  return 'generic'
}

export async function saveCollectionAction(storeId: string, slug: string, collectionId: string | null, fd: FormData) {
  await requireUser()
  const parsed = readCollectionForm(fd)
  if (!parsed.ok) return collectionId ? item(slug, collectionId, 'erro', 'invalid') : list(slug, 'erro', 'invalid')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_collection', { p_store: storeId, p_id: collectionId, p: parsed.payload })
  if (error) return list(slug, 'erro', errorCode(error))
  revalidatePath(`/app/${slug}`, 'layout')
  return item(slug, collectionId ?? String(data), 'ok', collectionId ? 'saved' : 'created')
}

export async function deleteCollectionAction(slug: string, collectionId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.from('collections').delete().eq('id', collectionId).select('id')
  if (error) return list(slug, 'erro', errorCode(error))
  if (!data?.length) return list(slug, 'erro', 'forbidden')
  revalidatePath(`/app/${slug}`, 'layout')
  return list(slug, 'ok', 'deleted')
}

/** Marca/desmarca coleções de UM produto (formulário na tela do produto). */
export async function setProductCollectionsAction(slug: string, productId: string, fd: FormData) {
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_product_collections', { p_product: productId, p_collections: readCollectionIds(fd) })
  const base = `/app/${slug}/produtos/${productId}`
  if (error) return redirect(`${base}?erro=${errorCode(error)}`)
  revalidatePath(`/app/${slug}`, 'layout')
  return redirect(`${base}?ok=collections`)
}

export async function addProductsToCollectionAction(slug: string, collectionId: string, fd: FormData) {
  await requireUser()
  const ids = fd.getAll('product').map(String).filter((v) => UUID.test(v))
  if (!ids.length) return item(slug, collectionId, 'erro', 'none')
  const supabase = await createClient()
  const { error } = await supabase.rpc('add_products_to_collection', { p_collection: collectionId, p_products: ids })
  if (error) return item(slug, collectionId, 'erro', errorCode(error))
  revalidatePath(`/app/${slug}`, 'layout')
  return item(slug, collectionId, 'ok', 'added')
}

export async function removeProductFromCollectionAction(slug: string, collectionId: string, productId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.from('collection_products').delete()
    .eq('collection_id', collectionId).eq('product_id', productId).select('product_id')
  if (error) return item(slug, collectionId, 'erro', errorCode(error))
  if (!data?.length) return item(slug, collectionId, 'erro', 'forbidden')
  revalidatePath(`/app/${slug}`, 'layout')
  return item(slug, collectionId, 'ok', 'removed')
}
