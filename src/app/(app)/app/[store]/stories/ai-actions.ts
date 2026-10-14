'use server'

import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/session'
import { AI_DAILY_LIMIT, AI_MAX_IMAGES, AiError, aiConfigured, suggestFromImages, type AiImage, type AiSuggestion } from '@/lib/ai'
import { normalizeFilters } from '@/lib/catalogFilters'

const UUID = /^[0-9a-f-]{36}$/i

export type SuggestResult = { ok: false; error: string } | { ok: true; suggestion: AiSuggestion; remaining: number }

/**
 * Pede à IA uma SUGESTÃO de cadastro a partir das imagens dos Stories. Não grava nada: devolve texto para preencher o
 * formulário, que uma pessoa revisa. Preço, estoque e situação não passam por aqui.
 */
export async function suggestStoriesAction(storeId: string, ids: string[]): Promise<SuggestResult> {
  await requireUser()
  if (!UUID.test(storeId)) return { ok: false, error: 'Pedido inválido.' }
  const wanted = [...new Set(ids)].filter((i) => UUID.test(i)).slice(0, AI_MAX_IMAGES)
  if (wanted.length === 0) return { ok: false, error: 'Pedido inválido.' }
  if (!aiConfigured()) return { ok: false, error: 'As sugestões de IA ainda não estão ligadas neste sistema. Preencha manualmente.' }

  const supabase = await createClient()
  const { data: rows } = await supabase.from('story_items').select('id, path, caption, status').eq('store_id', storeId).in('id', wanted)
  if (!rows || rows.length !== wanted.length || rows.some((r) => r.status !== 'pending')) return { ok: false, error: 'Story não encontrado.' }

  // limite diário por loja, imposto no banco e contado ANTES de gastar com a IA
  const { data: remaining, error: limitErr } = await supabase.rpc('ai_register_call', { p_store: storeId, p_limit: AI_DAILY_LIMIT })
  if (limitErr) {
    if (limitErr.code === '53400' || (limitErr.message ?? '').includes('ai_limit')) {
      return { ok: false, error: `A loja atingiu o limite de ${AI_DAILY_LIMIT} sugestões de IA por hoje. Preencha manualmente ou tente amanhã.` }
    }
    return { ok: false, error: 'Você não tem permissão para usar a IA nesta loja.' }
  }
  const refund = () => supabase.rpc('ai_refund_call', { p_store: storeId })

  try {
    const images: AiImage[] = []
    for (const id of wanted) {
      const path = rows.find((r) => r.id === id)!.path
      const file = await supabase.storage.from('stories').download(path)
      if (file.error || !file.data) throw new AiError('Não foi possível ler a imagem do Story.')
      images.push({ data: Buffer.from(await file.data.arrayBuffer()).toString('base64'), mediaType: path.endsWith('.jpg') ? 'image/jpeg' : 'image/webp' })
    }
    const [{ data: categories }, { data: collections }, { data: st }] = await Promise.all([
      supabase.from('categories').select('id, name').eq('store_id', storeId).order('position').order('name'),
      supabase.from('collections').select('id, name').eq('store_id', storeId).eq('kind', 'manual').order('name'),
      supabase.from('stores').select('catalog_filters').eq('id', storeId).maybeSingle(),
    ])
    const filters = normalizeFilters(st?.catalog_filters)
    const suggestion = await suggestFromImages(images, {
      categories: categories ?? [], collections: collections ?? [], styles: filters.style ? filters.styles : [],
      audiences: filters.audience ? filters.audiences : [],
      caption: wanted.map((id) => rows.find((r) => r.id === id)!.caption ?? '').filter(Boolean).join(' · '),
    })
    return { ok: true, suggestion, remaining: Number(remaining ?? 0) }
  } catch (e) {
    await refund() // a IA não respondeu: não gasta a cota da loja
    return { ok: false, error: e instanceof AiError ? e.message : 'Não foi possível gerar a sugestão agora. Preencha manualmente.' }
  }
}
