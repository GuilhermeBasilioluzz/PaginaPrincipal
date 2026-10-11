import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ProductForm, EMPTY_PRODUCT } from '@/components/ProductForm'
import { normalizeFilters } from '@/lib/catalogFilters'
import { can } from '@/lib/permissions'
import { getMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Novo produto' }

export default async function NewProductPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params
  const membership = await getMembership(slug)
  if (!membership) notFound()
  if (!can(membership.role, 'edit_products') || !membership.store.is_active) redirect(`/app/${slug}/produtos?erro=forbidden`)

  const supabase = await createClient()
  const [{ data: categories }, { data: st }] = await Promise.all([
    supabase.from('categories').select('id, name').eq('store_id', membership.store.id).order('position').order('name'),
    supabase.from('stores').select('catalog_filters').eq('id', membership.store.id).maybeSingle(),
  ])

  return (
    <div className="card narrow">
      <Link href={`/app/${slug}/produtos`} className="link small">← Produtos</Link>
      <h1>Novo produto</h1>
      <p className="muted small">Preencha o essencial. As fotos entram na próxima etapa.</p>
      <ProductForm storeId={membership.store.id} slug={slug} productId={null} initial={EMPTY_PRODUCT} categories={categories ?? []} archived={false} filters={normalizeFilters(st?.catalog_filters)} />
    </div>
  )
}
