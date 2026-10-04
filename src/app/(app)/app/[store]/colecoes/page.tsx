import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/session'
import { can } from '@/lib/permissions'
import { COLLECTION_FLASH } from '@/lib/flash'

export const metadata = { title: 'Coleções' }


type Row = { id: string; name: string; slug: string; description: string | null; kind: 'manual' | 'new_arrivals'; new_arrivals_days: number | null; is_published: boolean; item_count: number }

export default async function CollectionsPage({ params, searchParams }: {
  params: Promise<{ store: string }>; searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const [{ store: slug }, sp] = await Promise.all([params, searchParams])
  const membership = await getMembership(slug)
  if (!membership) notFound()
  const { store, role } = membership
  const manage = can(role, 'manage_structure') && store.is_active

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('store_collections_overview', { p_store: store.id })
  const rows = (data ?? []) as Row[]
  const flash = (sp.erro && COLLECTION_FLASH[sp.erro]) || (sp.ok && COLLECTION_FLASH[sp.ok]) || null

  return (
    <div className="stack-lg">
      {flash && <p className={`notice ${sp.erro ? 'notice-error' : 'notice-ok'}`} role={sp.erro ? 'alert' : 'status'}>{flash}</p>}
      <div className="row spread">
        <h2 style={{ margin: 0 }}>Coleções <span className="muted small">({rows.length})</span></h2>
        {manage && <Link href={`/app/${slug}/colecoes/nova`} className="btn btn-primary">+ Nova coleção</Link>}
      </div>
      <p className="muted small">
        Uma coleção agrupa peças por contexto (Primavera, Look da Semana, Stories de ontem…). A mesma peça pode estar em várias
        coleções, e cada uma tem seu próprio link.
      </p>
      {error && <p className="notice notice-error" role="alert">Não foi possível carregar as coleções.</p>}

      {!error && rows.length === 0 ? (
        <div className="card empty">
          <h2>Crie sua primeira coleção para organizar suas peças.</h2>
          {manage && <Link href={`/app/${slug}/colecoes/nova`} className="btn btn-primary">Criar coleção</Link>}
        </div>
      ) : (
        <ul className="collection-grid">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/app/${slug}/colecoes/${c.id}`} className="collection-card">
                <h3>{c.name}</h3>
                <span className="muted small">
                  {c.kind === 'new_arrivals' ? `Automática: peças dos últimos ${c.new_arrivals_days} dias` : c.description || `/${slug}/colecao/${c.slug}`}
                </span>
                <span className="row">
                  <span className="badge">{c.item_count} {Number(c.item_count) === 1 ? 'peça' : 'peças'}</span>
                  {c.kind === 'new_arrivals' && <span className="badge badge-auto">Automática</span>}
                  {!c.is_published && <span className="badge badge-warn">Rascunho</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
