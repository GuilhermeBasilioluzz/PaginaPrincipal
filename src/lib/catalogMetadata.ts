import type { Metadata } from 'next'
import { getCatalogStore } from './publicCatalog'
import { publicUrl } from './images'
import { getSupabaseEnv } from './supabase/env'

export async function catalogMetadata(slug: string, collectionSlug?: string): Promise<Metadata> {
  const catalog = await getCatalogStore(slug)
  if (!catalog) return { title: 'Catálogo não encontrado', robots: { index: false } }
  const { store } = catalog
  const collection = collectionSlug ? catalog.collections.find((c) => c.slug === collectionSlug) : undefined
  if (collectionSlug && !collection) return { title: 'Coleção não encontrada', robots: { index: false } }

  const title = collection ? `${collection.name} — ${store.name}` : store.tagline ? `${store.name} — ${store.tagline}` : store.name
  const description = (collection ? `Veja a coleção ${collection.name} da ${store.name}.` : store.description || store.tagline || `Catálogo da ${store.name}`).slice(0, 160)
  const imagePath = store.banner_path ?? store.logo_path
  const url = collection ? `/${store.slug}/colecao/${collection.slug}` : `/${store.slug}`
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: store.name, type: 'website', locale: 'pt_BR',
      ...(imagePath ? { images: [{ url: publicUrl(getSupabaseEnv()?.url ?? '', imagePath) }] } : {}) },
    twitter: { card: imagePath ? 'summary_large_image' : 'summary', title, description },
  }
}
