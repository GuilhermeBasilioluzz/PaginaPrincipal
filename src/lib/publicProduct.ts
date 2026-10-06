import { cache } from 'react'
import { createPublicClient } from './supabase/public'
import type { StockLabel } from './catalog'

export type CatalogProductPage = {
  store: { slug: string; name: string; whatsapp: string | null; instagram_handle: string | null; logo_path: string | null }
  product: {
    name: string; slug: string; description: string | null; price: number; promo_price: number | null; color: string | null
    sizes: string[]; stock_label: StockLabel; published_at: string
  }
  images: { path: string; kind: string; alt: string | null }[]
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
