import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StoryActions } from '@/components/StoryActions'
import { StoryUploader } from '@/components/StoryUploader'
import { can } from '@/lib/permissions'
import { getMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { STORY_TABS, storyAge, storyTab, storyThumbPath, type StoryItem } from '@/lib/stories'

export const metadata = { title: 'Stories recebidos' }
export const dynamic = 'force-dynamic'

export default async function StoriesPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<{ aba?: string }> }) {
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

      <nav className="chips-nav" aria-label="Situação">
        {STORY_TABS.map((t) => <Link key={t.key} href={t.key === 'pending' ? `/app/${slug}/stories` : `/app/${slug}/stories?aba=${t.key}`} aria-current={tab === t.key ? 'page' : undefined}>{t.label}</Link>)}
      </nav>

      {items.length === 0 ? (
        <div className="card empty">
          <h2>{tab === 'pending' ? 'Nenhum Story para revisar.' : 'Nada por aqui.'}</h2>
          {tab === 'pending' && <p className="muted">Envie os prints dos Stories da loja acima.</p>}
        </div>
      ) : (
        <ul className="photo-grid">
          {items.map((s) => (
            <li key={s.id} className="photo stack">
              {urlOf.get(storyThumbPath(s.path))
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={urlOf.get(storyThumbPath(s.path)) ?? ''} alt={s.caption ?? 'Story recebido'} width={240} height={320} loading="lazy" decoding="async" />
                : <div className="card empty">Imagem indisponível</div>}
              <p className="muted small">{storyAge(s.posted_at)}{s.author ? ` · ${s.author}` : ''}</p>
              {s.caption && <p className="small">{s.caption}</p>}
              {s.status === 'converted' && s.product_name && s.product_id && <p className="small">Virou <Link className="link" href={`/app/${slug}/produtos/${s.product_id}`}>{s.product_name}</Link></p>}
              {s.status === 'converted' && !s.product_id && <p className="muted small">O produto foi excluído.</p>}
              {s.status === 'pending' && editable && <Link href={`/app/${slug}/stories/${s.id}`} className="btn btn-primary">Transformar em produto</Link>}
              {editable && <StoryActions slug={slug} id={s.id} status={s.status} canDelete={can(role, 'delete_products')} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
