import { cache } from 'react'
import { createPublicClient } from './supabase/public'
import type { CatalogProduct, StockLabel } from './catalog'

export type CatalogProductPage = {
  store: { slug: string; name: string; whatsapp: string | null; instagram_handle: string | null; logo_path: string | null }
  product: {
    name: string; slug: string; description: string | null; price: number; promo_price: number | null; color: string | null
    sizes: string[]; stock_label: StockLabel; published_at: string
  }
  images: { path: string; kind: string; alt: string | null }[]
  category: { name: string; slug: string; parent_name: string | null; parent_slug: string | null } | null
  collections: { name: string; slug: string }[]
  interest_open: boolean
}

/** Uma consulta traz tudo da página da peça. null = peça ou loja indisponível. */
export const getCatalogProduct = cache(async (storeSlug: string, productSlug: string): Promise<CatalogProductPage | null> => {
  const supabase = createPublicClient()
  if (!supabase) return null
  const { data, error } = await supabase.rpc('catalog_product', { p_slug: storeSlug, p_product: productSlug })
  if (error || !data) return null
  return data as CatalogProductPage
})

export type RelatedProduct = Omit<CatalogProduct, 'total'> & { score: number }

/** "Você também pode gostar": mesma coleção, categoria e cor (ver catalog_related). */
export const getCatalogRelated = cache(async (storeSlug: string, productSlug: string): Promise<RelatedProduct[]> => {
  const supabase = createPublicClient()
  if (!supabase) return []
  const { data, error } = await supabase.rpc('catalog_related', { p_slug: storeSlug, p_product: productSlug, p_limit: 8 })
  return error ? [] : ((data ?? []) as RelatedProduct[])
})
