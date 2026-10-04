import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LiveRefresh } from '@/components/LiveRefresh'
import { ConfirmButton } from '@/components/ConfirmButton'
import { SubmitButton } from '@/components/ui'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/session'
import { can } from '@/lib/permissions'
import { PAGE_SIZE, pageNumber } from '@/lib/products'
import { STOCK_FLASH } from '@/lib/flash'
import { timeAgo } from '@/lib/dashboard'
import { RESERVATION_LABEL, type ReservationStatus } from '@/lib/stock'
import { setReservationStatusAction } from '../estoque/actions'

export const metadata = { title: 'Reservas' }

const TABS = { active: 'Ativas', picked_up: 'Retiradas', cancelled: 'Canceladas' } as const
type Tab = keyof typeof TABS

type Row = {
  id: string; product_id: string; product_name: string; size: string | null; quantity: number; customer_name: string
  customer_contact: string | null; note: string | null; status: ReservationStatus; expires_at: string | null; expired: boolean
  reserved_by_name: string | null; created_at: string; closed_at: string | null; closed_by_name: string | null; total: number
}

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default async function ReservationsPage({ params, searchParams }: {
  params: Promise<{ store: string }>; searchParams: Promise<{ tab?: string; page?: string; ok?: string; erro?: string }>
}) {
  const [{ store: slug }, sp] = await Promise.all([params, searchParams])
  const membership = await getMembership(slug)
  if (!membership) notFound()
  const { store, role } = membership
  const editable = can(role, 'update_stock') && store.is_active
  const tab: Tab = sp.tab && sp.tab in TABS ? (sp.tab as Tab) : 'active'
  const page = pageNumber(sp.page)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('store_reservations', { p_store: store.id, p_status: tab, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE })
  const rows = (data ?? []) as Row[]
  const total = rows[0] ? Number(rows[0].total) : 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const flash = (sp.erro && STOCK_FLASH[sp.erro]) || (sp.ok && STOCK_FLASH[sp.ok]) || null
  const href = (t: Tab, p = 1) => `/app/${slug}/reservas?tab=${t}${p > 1 ? `&page=${p}` : ''}`

  return (
    <div className="stack-lg">
      <LiveRefresh storeId={store.id} />
      {flash && <p className={`notice ${sp.erro ? 'notice-error' : 'notice-ok'}`} role={sp.erro ? 'alert' : 'status'}>{flash}</p>}

      <div className="row spread">
        <h2 style={{ margin: 0 }}>Reservas <span className="muted small">({total})</span></h2>
        {editable && <Link href={`/app/${slug}/reservas/nova`} className="btn btn-primary">+ Nova reserva</Link>}
      </div>
      <nav className="subnav wrap" aria-label="Situação das reservas">
        {(Object.keys(TABS) as Tab[]).map((t) => <Link key={t} href={href(t)} aria-current={t === tab ? 'page' : undefined}>{TABS[t]}</Link>)}
      </nav>

      {error && <p className="notice notice-error" role="alert">Não foi possível carregar as reservas.</p>}
      {!error && rows.length === 0 && (
        <div className="card empty">
          <h2>{tab === 'active' ? 'Nenhuma reserva ativa.' : 'Nada por aqui ainda.'}</h2>
          {tab === 'active' && <p className="muted">Quando alguém reservar uma peça para uma cliente, aparece aqui, com quem reservou e até quando.</p>}
        </div>
      )}

      <ul className="list">
        {rows.map((r) => (
          <li key={r.id} className="product-row">
            <div className="product-main" style={{ gridColumn: '1 / -1' }}>
              <span><strong>{r.customer_name}</strong>{r.customer_contact && <span className="muted small"> · {r.customer_contact}</span>}</span>
              <Link href={`/app/${slug}/produtos/${r.product_id}`} className="product-name">{r.quantity} × {r.product_name}{r.size ? ` (${r.size})` : ''}</Link>
              {r.note && <span className="muted small">“{r.note}”</span>}
              <span className="muted small">
                Reservado por {r.reserved_by_name || 'equipe'} em {when(r.created_at)}
                {r.status === 'picked_up' && r.closed_at && ` · retirada em ${when(r.closed_at)} (baixa por ${r.closed_by_name || 'equipe'})`}
                {r.status === 'cancelled' && r.closed_at && ` · cancelada em ${when(r.closed_at)} por ${r.closed_by_name || 'equipe'}`}
                {(r.status === 'confirmed' || r.status === 'requested') && r.expires_at && ` · ${r.expired ? 'venceu em' : 'segura até'} ${when(r.expires_at)}`}
              </span>
            </div>
            <div className="product-side" style={{ gridColumn: '1 / -1' }}>
              <span className={`badge${r.status === 'cancelled' ? ' badge-warn' : r.status === 'requested' ? ' badge-auto' : ''}`}>{RESERVATION_LABEL[r.status]}</span>
              {r.expired && <span className="badge badge-warn">Vencida (não segura mais a peça)</span>}
            </div>
            {editable && (r.status === 'requested' || r.status === 'confirmed') && (
              <div className="row product-actions" style={{ gridColumn: '1 / -1' }}>
                {r.status === 'requested' && <form action={setReservationStatusAction.bind(null, slug, r.id, 'confirmed')}><SubmitButton variant="ghost">Confirmar</SubmitButton></form>}
                <form action={setReservationStatusAction.bind(null, slug, r.id, 'picked_up')}>
                  <ConfirmButton variant="ghost" message={`Registrar a retirada de ${r.quantity} × ${r.product_name} por ${r.customer_name}? A peça sai do estoque.`}>Retirada (vendida)</ConfirmButton>
                </form>
                <form action={setReservationStatusAction.bind(null, slug, r.id, 'cancelled')}>
                  <ConfirmButton message={`Cancelar a reserva de ${r.customer_name}? A peça volta a ficar livre.`}>Cancelar reserva</ConfirmButton>
                </form>
              </div>
            )}
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <nav className="row spread" aria-label="Páginas">
          {page > 1 ? <Link className="btn btn-ghost" href={href(tab, page - 1)}>← Anterior</Link> : <span />}
          <span className="muted small">Página {page} de {pages}</span>
          {page < pages ? <Link className="btn btn-ghost" href={href(tab, page + 1)}>Próxima →</Link> : <span />}
        </nav>
      )}
    </div>
  )
}
