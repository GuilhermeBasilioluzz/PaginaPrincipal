'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/session'
import { dbErrorMessage } from '@/lib/errors'
import { readProductForm } from '@/lib/products'
import { imagePath, thumbPath } from '@/lib/images'
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

/**
 * Transforma o Story em produto RASCUNHO (indisponível, fora do catálogo) e copia a imagem para as fotos do produto.
 * Quem publica é uma pessoa, na tela do produto.
 */
export async function convertStoryAction(storeId: string, slug: string, storyId: string, _: FormState, fd: FormData): Promise<FormState> {
  await requireUser()
  if (!UUID.test(storeId) || !UUID.test(storyId)) return { error: 'Pedido inválido.' }
  const parsed = readProductForm(fd, { keepStatus: true })
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const { data: story } = await supabase.from('story_items').select('path, status').eq('id', storyId).eq('store_id', storeId).maybeSingle()
  if (!story) return { error: 'Story não encontrado.' }
  if (story.status !== 'pending') return { error: 'Este Story já foi tratado.' }

  const { data: productId, error } = await supabase.rpc('convert_story', { p_story: storyId, p: parsed.payload })
  if (error) return { error: dbErrorMessage(error) }

  // copia a imagem (e a miniatura) do bucket privado para as fotos do produto; se falhar, o produto já existe e a foto pode ser enviada depois
  let photoFailed = false
  try {
    const imageId = crypto.randomUUID()
    const ext = story.path.endsWith('.jpg') ? 'jpg' : 'webp'
    const dest = imagePath(storeId, String(productId), imageId, ext)
    const type = ext === 'webp' ? 'image/webp' : 'image/jpeg'
    const [main, thumb] = await Promise.all([
      supabase.storage.from('stories').download(story.path),
      supabase.storage.from('stories').download(storyThumbPath(story.path)),
    ])
    if (main.error || !main.data) throw new Error('main')
    const opts = { contentType: type, cacheControl: '31536000', upsert: false }
    const up = await supabase.storage.from('catalog').upload(dest, main.data, opts)
    if (up.error) throw new Error('upload')
    const upThumb = thumb.data ? await supabase.storage.from('catalog').upload(thumbPath(dest), thumb.data, opts) : { error: null }
    const { error: regErr } = await supabase.from('product_images').insert({ store_id: storeId, product_id: productId, path: dest, kind: 'front' })
    if (regErr || upThumb.error) {
      await supabase.storage.from('catalog').remove([dest, thumbPath(dest)])
      throw new Error('register')
    }
  } catch {
    photoFailed = true
  }

  revalidatePath(`/app/${slug}`, 'layout')
  redirect(`/app/${slug}/produtos/${productId}?ok=${photoFailed ? 'story_nophoto' : 'story'}`)
}
