import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LiveRefresh } from '@/components/LiveRefresh'
import { createClient } from '@/lib/supabase/server'
import { getMembership, requireUser } from '@/lib/session'
import { can } from '@/lib/permissions'
import { PAGE_SIZE, pageNumber } from '@/lib/products'
import { timeAgo } from '@/lib/dashboard'
import { TYPE_LABEL, describeActivity, type ActivityItem } from '@/lib/activity'
import type { TeamMember } from '@/lib/types'

export const metadata = { title: 'Atividades' }

const UUID = /^[0-9a-f-]{36}$/i

export default async function ActivityPage({ params, searchParams }: {
  params: Promise<{ store: string }>; searchParams: Promise<{ pessoa?: string; tipo?: string; pagina?: string }>
}) {
  const [{ store: slug }, sp] = await Promise.all([params, searchParams])
  const membership = await getMembership(slug)
  if (!membership) notFound()
  const user = await requireUser()
  const { store, role } = membership
  const seeAll = can(role, 'view_all_activity')

  const actor = seeAll && sp.pessoa && UUID.test(sp.pessoa) ? sp.pessoa : null
  const type = sp.tipo && sp.tipo in TYPE_LABEL ? sp.tipo : null
  const page = pageNumber(sp.pagina)

  const supabase = await createClient()
  const [activityRes, teamRes] = await Promise.all([
    supabase.rpc('store_activity', { p_store: store.id, p_actor: actor, p_type: type, p_entity: null, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    seeAll ? supabase.rpc('store_team', { p_store: store.id }) : Promise.resolve({ data: [] as TeamMember[] }),
  ])
  const items = (activityRes.data ?? []) as ActivityItem[]
  const team = (teamRes.data ?? []) as TeamMember[]
  const total = items[0] ? Number(items[0].total) : 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const href = (o: { pessoa?: string | null; tipo?: string | null; pagina?: number }) => {
    const u = new URLSearchParams()
    const pe = o.pessoa === undefined ? actor : o.pessoa
    const ti = o.tipo === undefined ? type : o.tipo
    if (pe) u.set('pessoa', pe)
    if (ti) u.set('tipo', ti)
    if ((o.pagina ?? 1) > 1) u.set('pagina', String(o.pagina))
    return `/app/${slug}/atividades${u.size ? `?${u}` : ''}`
  }

  return (
    <div className="stack-lg">
      <LiveRefresh storeId={store.id} />
      <div>
        <h2 style={{ margin: 0 }}>Atividades</h2>
        <p className="muted small">
          {seeAll ? 'Tudo o que a equipe fez na loja, com quem fez e quando.' : 'Aqui aparecem as suas ações. Dono e gerente veem as de toda a equipe.'}
        </p>
      </div>

      {seeAll && team.length > 1 && (
        <nav className="subnav wrap" aria-label="Filtrar por pessoa">
          <Link href={href({ pessoa: null })} aria-current={!actor ? 'page' : undefined}>Todos</Link>
          {team.map((m) => <Link key={m.user_id} href={href({ pessoa: m.user_id })} aria-current={actor === m.user_id ? 'page' : undefined}>{m.user_id === user.id ? 'Eu' : m.full_name || m.email || 'Sem nome'}</Link>)}
        </nav>
      )}
      <nav className="subnav wrap" aria-label="Filtrar por tipo">
        <Link href={href({ tipo: null })} aria-current={!type ? 'page' : undefined}>Tudo</Link>
        {Object.entries(TYPE_LABEL).map(([k, v]) => <Link key={k} href={href({ tipo: k })} aria-current={type === k ? 'page' : undefined}>{v}</Link>)}
      </nav>

      {activityRes.error && <p className="notice notice-error" role="alert">Não foi possível carregar as atividades.</p>}
      {!activityRes.error && items.length === 0 ? (
        <div className="card empty">
          <h2>Nenhuma atividade por aqui.</h2>
          <p className="muted">Quando a equipe cadastrar peças, mexer no estoque ou mudar configurações, aparece aqui.</p>
        </div>
      ) : (
        <div className="card">
          <ul className="activity">
            {items.map((a) => (
              <li key={a.id}>
                <span className="muted small" title={new Date(a.created_at).toLocaleString('pt-BR')}>{timeAgo(a.created_at)}</span>
                <span>
                  {describeActivity({ action: a.action, entity_name: a.entity_name, details: a.details, actor_name: a.actor_id === user.id ? 'Você' : a.actor_name })}
                  {a.entity_type === 'product' && a.entity_id && !a.action.endsWith('.deleted') && <> · <Link href={`/app/${slug}/produtos/${a.entity_id}`} className="link small">ver peça</Link></>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pages > 1 && (
        <nav className="row spread" aria-label="Páginas">
          {page > 1 ? <Link className="btn btn-ghost" href={href({ pagina: page - 1 })}>← Anterior</Link> : <span />}
          <span className="muted small">Página {page} de {pages}</span>
          {page < pages ? <Link className="btn btn-ghost" href={href({ pagina: page + 1 })}>Próxima →</Link> : <span />}
        </nav>
      )}
    </div>
  )
}
