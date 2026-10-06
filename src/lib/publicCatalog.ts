import { cache } from 'react'
import { createPublicClient } from './supabase/public'
import { CATALOG_PAGE_SIZE, type CatalogProduct, type CatalogQuery, type CatalogStore } from './catalog'

/** Dados da loja e filtros disponíveis. null = loja inexistente, desligada ou desativada. Uma consulta por pedido. */
export const getCatalogStore = cache(async (slug: string): Promise<CatalogStore | null> => {
  const supabase = createPublicClient()
  if (!supabase) return null
  const { data, error } = await supabase.rpc('catalog_store', { p_slug: slug })
  if (error || !data) return null
  return data as CatalogStore
})

export async function getCatalogProducts(slug: string, q: CatalogQuery, collection: string): Promise<{ items: CatalogProduct[]; total: number; failed: boolean }> {
  const supabase = createPublicClient()
  if (!supabase) return { items: [], total: 0, failed: true }
  const { data, error } = await supabase.rpc('catalog_products', {
    p_slug: slug, p_q: q.q, p_category: q.category, p_collection: collection, p_color: q.color, p_size: q.size,
    p_min: q.min, p_max: q.max, p_in_stock: q.stock, p_sort: q.sort,
    p_limit: CATALOG_PAGE_SIZE, p_offset: (q.page - 1) * CATALOG_PAGE_SIZE,
  })
  if (error) return { items: [], total: 0, failed: true }
  const items = (data ?? []) as CatalogProduct[]
  return { items, total: items[0] ? Number(items[0].total) : 0, failed: false }
}
