'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/session'
import { dbErrorMessage } from '@/lib/errors'
import { readProductForm } from '@/lib/products'
import { MAX_IMAGES, imagePath, nextKind, thumbPath, type ImageKind } from '@/lib/images'
import { MAX_STORY_CAPTION, isValidStoryPath, storyThumbPath, type StoryTab } from '@/lib/stories'
import type { FormState } from '@/lib/types'
import type { ActionResult } from '../produtos/image-actions'

const UUID = /^[0-9a-f-]{36}$/i
const refresh = (slug: string) => revalidatePath(`/app/${slug}/stories`)

/** Registra um Story que o navegador acabou de enviar ao Storage (bucket privado). */
export async function registerStoryAction(storeId: string, slug: string, path: string, caption: string): Promise<ActionResult> {
  await requireUser()
  if (!UUID.test(storeId) || !isValidStoryPath(path, storeId)) return { error: 'Arquivo inválido.' }
  const supabase = await createClient()
  const { error } = await supabase.from('story_items').insert({ store_id: storeId, path, caption: caption.trim().slice(0, MAX_STORY_CAPTION) || null })
  if (error) return { error: dbErrorMessage(error) }
  refresh(slug)
  return { ok: true }
}

async function setStatus(slug: string, id: string, status: Exclude<StoryTab, 'converted'>): Promise<ActionResult> {
  await requireUser()
  if (!UUID.test(id)) return { error: 'Pedido inválido.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('story_items').update({ status }).eq('id', id).select('id')
  if (error) return { error: dbErrorMessage(error) }
  if (!data?.length) return { error: 'Não foi possível alterar este Story.' }
  refresh(slug)
  return { ok: true }
}
export async function discardStoryAction(slug: string, id: string): Promise<ActionResult> {
  return setStatus(slug, id, 'discarded')
}
export async function restoreStoryAction(slug: string, id: string): Promise<ActionResult> {
  return setStatus(slug, id, 'pending')
}

/** Apaga o registro e os arquivos. Só dono e gerente (regra do banco). */
export async function deleteStoryAction(slug: string, id: string): Promise<ActionResult> {
  await requireUser()
  if (!UUID.test(id)) return { error: 'Pedido inválido.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('story_items').delete().eq('id', id).select('path')
  if (error) return { error: dbErrorMessage(error) }
  if (!data?.length) return { error: 'Só dono e gerente excluem Stories. Você pode descartar.' }
  await supabase.storage.from('stories').remove(data.flatMap((r) => [r.path, storyThumbPath(r.path)]))
  refresh(slug)
  return { ok: true }
}

const parseIds = (raw: string[]) => [...new Set(raw)].filter((i) => UUID.test(i)).slice(0, 8)

/**
 * Copia as imagens dos Stories (bucket privado) para as fotos do produto, na ordem recebida.
 * Devolve quantas falharam: o produto/vínculo já existe e a foto pode ser enviada depois.
 */
async function copyStoryImages(
  supabase: Awaited<ReturnType<typeof createClient>>, storeId: string, productId: string, paths: string[], used: string[],
): Promise<number> {
  let failed = 0
  for (const path of paths) {
    try {
      const ext = path.endsWith('.jpg') ? 'jpg' : 'webp'
      const dest = imagePath(storeId, productId, crypto.randomUUID(), ext)
      const opts = { contentType: ext === 'webp' ? 'image/webp' : 'image/jpeg', cacheControl: '31536000', upsert: false }
      const [main, thumb] = await Promise.all([
        supabase.storage.from('stories').download(path),
        supabase.storage.from('stories').download(storyThumbPath(path)),
      ])
      if (main.error || !main.data) throw new Error('main')
      const up = await supabase.storage.from('catalog').upload(dest, main.data, opts)
      if (up.error) throw new Error('upload')
      const upThumb = thumb.data ? await supabase.storage.from('catalog').upload(thumbPath(dest), thumb.data, opts) : { error: null }
      const kind: ImageKind = nextKind(used)
      const { error } = await supabase.from('product_images').insert({ store_id: storeId, product_id: productId, path: dest, kind })
      if (error || upThumb.error) {
        await supabase.storage.from('catalog').remove([dest, thumbPath(dest)])
        throw new Error('register')
      }
      used.push(kind)
    } catch {
      failed += 1
    }
  }
  return failed
}

/** A Story pendente mais recente: o "próximo" da fila de revisão. */
async function nextPending(supabase: Awaited<ReturnType<typeof createClient>>, storeId: string): Promise<string | null> {
  const { data } = await supabase.from('story_items').select('id').eq('store_id', storeId).eq('status', 'pending')
    .order('posted_at', { ascending: false }).limit(1)
  return data?.[0]?.id ?? null
}

/**
 * Transforma 1 a 8 Stories em UM produto RASCUNHO (indisponível, fora do catálogo) e copia as imagens para as fotos.
 * Quem publica é uma pessoa, na tela do produto.
 */
export async function convertStoriesAction(storeId: string, slug: string, rawIds: string[], _: FormState, fd: FormData): Promise<FormState> {
  await requireUser()
  const ids = parseIds(rawIds)
  if (!UUID.test(storeId) || ids.length === 0) return { error: 'Pedido inválido.' }
  const parsed = readProductForm(fd, { keepStatus: true })
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const { data: rows } = await supabase.from('story_items').select('id, path, status').eq('store_id', storeId).in('id', ids)
  if (!rows || rows.length !== ids.length) return { error: 'Story não encontrado.' }
  if (rows.some((r) => r.status !== 'pending')) return { error: 'Algum destes Stories já foi tratado.' }
  const paths = ids.map((id) => rows.find((r) => r.id === id)!.path)

  const { data: productId, error } = await supabase.rpc('convert_stories', { p_stories: ids, p: parsed.payload })
  if (error) return { error: dbErrorMessage(error) }

  const collections = fd.getAll('collections').map(String).filter((c) => UUID.test(c))
  if (collections.length) await supabase.rpc('set_product_collections', { p_product: productId, p_collections: collections })
  const failed = await copyStoryImages(supabase, storeId, String(productId), paths, [])

  revalidatePath(`/app/${slug}`, 'layout')
  if (fd.get('next') === 'on') {
    const next = await nextPending(supabase, storeId)
    if (next) redirect(`/app/${slug}/stories/converter?ids=${next}&feito=1`)
    redirect(`/app/${slug}/stories?feito=fila`)
  }
  redirect(`/app/${slug}/produtos/${productId}?ok=${failed ? 'story_nophoto' : 'story'}`)
}

/** Anexa os Stories como fotos de um produto que já existe (até 8 fotos no total). */
export async function attachStoriesAction(storeId: string, slug: string, rawIds: string[], productId: string): Promise<ActionResult & { productId?: string }> {
  await requireUser()
  const ids = parseIds(rawIds)
  if (!UUID.test(storeId) || !UUID.test(productId) || ids.length === 0) return { error: 'Pedido inválido.' }
  const supabase = await createClient()
  const { data: rows } = await supabase.from('story_items').select('id, path, status').eq('store_id', storeId).in('id', ids)
  if (!rows || rows.length !== ids.length) return { error: 'Story não encontrado.' }
  const paths = ids.map((id) => rows.find((r) => r.id === id)!.path)

  const { data: existing } = await supabase.from('product_images').select('kind').eq('product_id', productId)
  if ((existing?.length ?? 0) + ids.length > MAX_IMAGES) return { error: `Cada produto aceita até ${MAX_IMAGES} fotos.` }
  const { error } = await supabase.rpc('attach_stories', { p_stories: ids, p_product: productId })
  if (error) return { error: dbErrorMessage(error) }

  const failed = await copyStoryImages(supabase, storeId, productId, paths, (existing ?? []).map((r) => r.kind))
  revalidatePath(`/app/${slug}`, 'layout')
  return failed ? { error: `${failed} imagem(ns) não puderam ser copiadas. Envie-as pela tela do produto.`, productId } : { ok: true, productId }
}
