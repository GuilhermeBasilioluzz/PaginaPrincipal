import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BrandingUploader } from '@/components/BrandingUploader'
import { StoreSettingsForm } from '@/components/StoreSettingsForm'
import { CatalogFiltersForm } from '@/components/CatalogFiltersForm'
import { normalizeFilters } from '@/lib/catalogFilters'
import { can } from '@/lib/permissions'
import { getMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseEnv, siteUrl } from '@/lib/supabase/env'
import { formatWhatsapp } from '@/lib/storeSettings'

export const metadata = { title: 'Configurações da loja' }

export default async function SettingsPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params
  const membership = await getMembership(slug)
  if (!membership) notFound()
  const { store, role } = membership
  const owner = can(role, 'edit_store') && store.is_active

  const supabase = await createClient()
  const { data: s } = await supabase.from('stores')
    .select('name, tagline, description, whatsapp, instagram_handle, address, opening_hours, accent_color, catalog_enabled, hide_sold_out, catalog_filters, logo_path, banner_path')
    .eq('id', store.id).maybeSingle()
  if (!s) notFound()
  const catalogUrl = `${siteUrl()}/${store.slug}`
  const supabaseUrl = getSupabaseEnv()?.url ?? ''

  return (
    <div className="narrow stack-lg">
      <div className="card stack">
        <h2>Endereço do catálogo</h2>
        <p><code>{catalogUrl}</code></p>
        <div className="row">
          <Link href={`/${store.slug}`} target="_blank" className="btn btn-ghost">Abrir catálogo</Link>
        </div>
        <p className="muted small">Cole este link na bio do Instagram e nos Stories. Se o catálogo estiver desligado ou a loja sem peças, a cliente verá uma página vazia.</p>
      </div>

      {!owner && (
        <p className="notice">Só o dono da loja altera as configurações. {s.whatsapp && <>WhatsApp atual: {formatWhatsapp(s.whatsapp)}.</>}</p>
      )}

      <div className="card stack">
        <h2>Identidade visual</h2>
        <BrandingUploader storeId={store.id} slug={slug} kind="logo" currentPath={s.logo_path} supabaseUrl={supabaseUrl} canEdit={owner} />
        <BrandingUploader storeId={store.id} slug={slug} kind="banner" currentPath={s.banner_path} supabaseUrl={supabaseUrl} canEdit={owner} />
      </div>

      {owner && (
        <div className="card">
          <StoreSettingsForm storeId={store.id} slug={slug} initial={{
            name: s.name, tagline: s.tagline ?? '', description: s.description ?? '', whatsapp: s.whatsapp ? formatWhatsapp(s.whatsapp) : '',
            instagram: s.instagram_handle ? `@${s.instagram_handle}` : '', address: s.address ?? '', hours: s.opening_hours ?? '',
            accent: s.accent_color ?? '', catalogEnabled: s.catalog_enabled, hideSoldOut: s.hide_sold_out,
          }} />
        </div>
      )}

      {owner && (
        <div className="card" id="filtros">
          <CatalogFiltersForm storeId={store.id} slug={slug} initial={normalizeFilters(s.catalog_filters)} />
        </div>
      )}
    </div>
  )
}
