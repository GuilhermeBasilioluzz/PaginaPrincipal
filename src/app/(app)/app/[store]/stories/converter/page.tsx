import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { StoryConvertForm } from '@/components/StoryConvertForm'
import { normalizeFilters } from '@/lib/catalogFilters'
import { can } from '@/lib/permissions'
import { getMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { storyThumbPath } from '@/lib/stories'
import { aiConfigured } from '@/lib/ai'

export const metadata = { title: 'Transformar Stories em produto' }
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ConvertStoriesPage({ params, searchParams }: {
  params: Promise<{ store: string }>; searchParams: Promise<{ ids?: string; feito?: string }>
}) {
  const [{ store: slug }, sp] = await Promise.all([params, searchParams])
  const membership = await getMembership(slug)
  if (!membership) notFound()
  const { store, role } = membership
  if (!can(role, 'edit_products') || !store.is_active) redirect(`/app/${slug}/stories`)

  const ids = [...new Set((sp.ids ?? '').split(','))].filter((i) => UUID.test(i)).slice(0, 8)
  if (ids.length === 0) redirect(`/app/${slug}/stories`)

  const supabase = await createClient()
  const { data: rows } = await supabase.from('story_items').select('id, path, caption, status').eq('store_id', store.id).in('id', ids)
  if (!rows || rows.length !== ids.length || rows.some((r) => r.status !== 'pending')) redirect(`/app/${slug}/stories`)
  const ordered = ids.map((id) => rows.find((r) => r.id === id)!)

  const [{ data: categories }, { data: collections }, { data: st }, signed, { count: pending }] = await Promise.all([
    supabase.from('categories').select('id, name').eq('store_id', store.id).order('position').order('name'),
    supabase.from('collections').select('id, name').eq('store_id', store.id).eq('kind', 'manual').order('name'),
    supabase.from('stores').select('catalog_filters').eq('id', store.id).maybeSingle(),
    supabase.storage.from('stories').createSignedUrls(ordered.map((r) => storyThumbPath(r.path)), 3600),
    supabase.from('story_items').select('id', { count: 'exact', head: true }).eq('store_id', store.id).eq('status', 'pending'),
  ])
  const urlOf = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]))
  const caption = ordered.map((r) => r.caption).filter(Boolean).join(' · ')

  return (
    <div className="card narrow stack">
      <Link href={`/app/${slug}/stories`} className="link small">← Stories</Link>
      <h1>{ids.length === 1 ? 'Transformar em produto' : `Criar 1 produto com ${ids.length} fotos`}</h1>
      {sp.feito && <p className="notice notice-ok" role="status">Produto rascunho criado. Aqui está o próximo Story da fila.</p>}
      <div className="row">
        {ordered.map((r, i) => {
          const url = urlOf.get(storyThumbPath(r.path))
          // eslint-disable-next-line @next/next/no-img-element
          return url ? <img key={r.id} src={url} alt={`Story ${i + 1}${i === 0 ? ' (foto principal)' : ''}`} width={96} height={128} style={{ width: '6rem', height: 'auto', borderRadius: '0.5rem' }} /> : null
        })}
      </div>
      <StoryConvertForm storeId={store.id} slug={slug} storyIds={ids} caption={caption} categories={categories ?? []} collections={collections ?? []}
        filters={normalizeFilters(st?.catalog_filters)} hasMorePending={(pending ?? 0) > ids.length} aiEnabled={aiConfigured()} />
    </div>
  )
}
