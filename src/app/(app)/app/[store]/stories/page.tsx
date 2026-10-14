import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StoryList } from '@/components/StoryList'
import { StoryUploader } from '@/components/StoryUploader'
import { can } from '@/lib/permissions'
import { getMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { STORY_TABS, storyTab, storyThumbPath, type StoryItem } from '@/lib/stories'

export const metadata = { title: 'Stories recebidos' }
export const dynamic = 'force-dynamic'

export default async function StoriesPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<{ aba?: string; feito?: string }> }) {
  const [{ store: slug }, sp] = await Promise.all([params, searchParams])
  const membership = await getMembership(slug)
  if (!membership) notFound()
  const { store, role } = membership
  const tab = storyTab(sp.aba)
  const editable = can(role, 'edit_products') && store.is_active

  const supabase = await createClient()
  const { data } = await supabase.rpc('store_stories', { p_store: store.id, p_status: tab, p_limit: 60, p_offset: 0 })
  const items = (data ?? []) as StoryItem[]
  // bucket privado: a imagem só aparece por link temporário (1 h) gerado para quem é da equipe
  const signed = items.length ? await supabase.storage.from('stories').createSignedUrls(items.map((i) => storyThumbPath(i.path)), 3600) : { data: [] }
  // produtos que podem receber fotos (só na aba de revisão): os 200 mais recentes que não estão arquivados
  const { data: prods } = tab === 'pending' && editable
    ? await supabase.from('products').select('id, name').eq('store_id', store.id).neq('status', 'archived').order('created_at', { ascending: false }).limit(200)
    : { data: [] as { id: string; name: string }[] }
  const products = prods ?? []
  const urlOf = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]))

  return (
    <div className="stack-lg">
      <div className="card stack">
        <div>
          <h2>Stories recebidos</h2>
          <p className="muted small">Os Stories do Instagram somem em 24 horas. Tire um print ou salve a imagem, envie aqui e transforme em produto do catálogo permanente. Nada vai para o catálogo sem você revisar e publicar.</p>
        </div>
        {editable ? <StoryUploader storeId={store.id} slug={slug} /> : <p className="notice">Você só pode consultar os Stories.</p>}
      </div>

      {sp.feito === 'fila' && <p className="notice notice-ok" role="status">Fila zerada: não há mais Stories para revisar.</p>}
      <nav className="chips-nav" aria-label="Situação">
        {STORY_TABS.map((t) => <Link key={t.key} href={t.key === 'pending' ? `/app/${slug}/stories` : `/app/${slug}/stories?aba=${t.key}`} aria-current={tab === t.key ? 'page' : undefined}>{t.label}</Link>)}
      </nav>

      {items.length === 0 ? (
        <div className="card empty">
          <h2>{tab === 'pending' ? 'Nenhum Story para revisar.' : 'Nada por aqui.'}</h2>
          {tab === 'pending' && <p className="muted">Envie os prints dos Stories da loja acima.</p>}
        </div>
      ) : (
        <StoryList storeId={store.id} slug={slug} editable={editable} canDelete={can(role, 'delete_products')} products={products}
          items={items.map((s) => ({ ...s, url: urlOf.get(storyThumbPath(s.path)) ?? null }))} />
      )}
    </div>
  )
}
