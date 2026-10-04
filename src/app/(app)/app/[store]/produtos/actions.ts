'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/session'
import { dbErrorMessage } from '@/lib/errors'
import { readProductForm } from '@/lib/products'
import { thumbPath } from '@/lib/images'
import type { FormState } from '@/lib/types'

const base = (slug: string) => `/app/${slug}/produtos`
const flash = (slug: string, key: 'ok' | 'erro', code: string): never => redirect(`${base(slug)}?${key}=${code}`)

function errorCode(error: { code?: string; message?: string }): string {
  if (error.code === '42501') return 'forbidden'
  if ((error.message ?? '').includes('not_found') || error.code === 'P0002') return 'not_found'
  return 'generic'
}

/** Cria (productId nulo) ou atualiza. Tudo (produto + estoque) é gravado de uma vez no banco. */
export async function saveProductAction(
  storeId: string, slug: string, productId: string | null, keepStatus: boolean,
  _: FormState, fd: FormData,
): Promise<FormState> {
  await requireUser()
  const parsed = readProductForm(fd, { keepStatus })
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_product', { p_store: storeId, p_id: productId, p: parsed.payload })
  if (error) return { error: dbErrorMessage(error) }

  revalidatePath(`/app/${slug}`, 'layout')
  // produto novo: vai direto para a edição, onde já dá para enviar as fotos
  if (!productId && data) redirect(`${base(slug)}/${data}?ok=created`)
  return flash(slug, 'ok', 'saved')
}

export async function duplicateProductAction(storeId: string, slug: string, productId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('duplicate_product', { p_product: productId })
  if (error) return flash(slug, 'erro', errorCode(error))
  revalidatePath(`/app/${slug}`, 'layout')
  return redirect(`${base(slug)}/${data}?ok=duplicated`)
}

async function setStatus(slug: string, productId: string, status: 'archived' | 'unavailable', okCode: string) {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.from('products').update({ status }).eq('id', productId).select('id')
  if (error) return flash(slug, 'erro', errorCode(error))
  if (!data?.length) return flash(slug, 'erro', 'forbidden')
  revalidatePath(`/app/${slug}`, 'layout')
  return flash(slug, 'ok', okCode)
}

export async function archiveProductAction(slug: string, productId: string) {
  return setStatus(slug, productId, 'archived', 'archived')
}

/** Restaurar volta como "indisponível" (fora do catálogo) até a equipe revisar e publicar. */
export async function restoreProductAction(slug: string, productId: string) {
  return setStatus(slug, productId, 'unavailable', 'restored')
}

export async function deleteProductAction(slug: string, productId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data: imgs } = await supabase.from('product_images').select('path').eq('product_id', productId)
  const { data, error } = await supabase.from('products').delete().eq('id', productId).select('id')
  if (error) return flash(slug, 'erro', errorCode(error))
  if (!data?.length) return flash(slug, 'erro', 'forbidden') // atendente não apaga: arquiva
  // o banco apagou as fotos em cascata; agora remove os arquivos do Storage (sem sobrar lixo)
  if (imgs?.length) await supabase.storage.from('catalog').remove(imgs.flatMap((r) => [r.path, thumbPath(r.path)]))
  revalidatePath(`/app/${slug}`, 'layout')
  return flash(slug, 'ok', 'deleted')
}
