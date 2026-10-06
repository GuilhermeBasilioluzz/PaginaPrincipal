import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LiveRefresh } from '@/components/LiveRefresh'
import { SubmitButton } from '@/components/ui'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/session'
import { can } from '@/lib/permissions'
import { PAGE_SIZE, pageNumber, searchTerm } from '@/lib/products'
import { STOCK_FLASH } from '@/lib/flash'
import { timeAgo } from '@/lib/dashboard'
import type { InterestOverviewRow } from '@/lib/interest'
import { STATE_LABEL, describeMovement, parseTotals, type FeedItem, type StockRow } from '@/lib/stock'
import { adjustStockAction } from './actions'

export const metadata = { title: 'Estoque ao vivo' }

const FILTERS = { all: 'Todos', low: 'Poucas unidades', out: 'Esgotados', reserved: 'Com reservas' } as const
type Filter = keyof typeof FILTERS
const nf = new Intl.NumberFormat('pt-BR')

export default async function StockPage({ params, searchParams }: {
  params: Promise<{ store: string }>
  searchParams: Promise<{ q?: string; f?: string; page?: string; ok?: string; erro?: string }>
}) {
  const [{ store: slug }, sp] = await Promise.all([params, searchParams])
  const membership = await getMembership(slug)
  if (!membership) notFound()
  const { store, role } = membership
  const editable = can(role, 'update_stock') && store.is_active

  const q = searchTerm(sp.q)
  const filter: Filter = sp.f && sp.f in FILTERS ? (sp.f as Filter) : 'all'
  const page = pageNumber(sp.page)

  const supabase = await createClient()
  const [totalsRes, rowsRes, feedRes, demandRes] = await Promise.all([
    supabase.rpc('store_stock_totals', { p_store: store.id }),
    supabase.rpc('store_stock_overview', { p_store: store.id, p_filter: filter, p_q: q, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    supabase.rpc('store_stock_feed', { p_store: store.id, p_limit: 20 }),
    supabase.rpc('store_interest_overview', { p_store: store.id }),
  ])
  const demand = new Map(((demandRes.data ?? []) as InterestOverviewRow[]).map((d) => [d.product_id, d]))
  const totals = parseTotals(totalsRes.data)
  const rows = (rowsRes.data ?? []) as StockRow[]
  const feed = (feedRes.data ?? []) as FeedItem[]
  const total = rows[0] ? Number(rows[0].total) : 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const flash = (sp.erro && STOCK_FLASH[sp.erro]) || (sp.ok && STOCK_FLASH[sp.ok]) || null
  const here = `/app/${slug}/estoque`
  const href = (o: { f?: Filter; page?: number }) => {
    const u = new URLSearchParams()
    if (q) u.set('q', q)
    const f = o.f ?? filter
    if (f !== 'all') u.set('f', f)
    if ((o.page ?? 1) > 1) u.set('page', String(o.page))
    return `${here}${u.size ? `?${u}` : ''}`
  }

  return (
    <div className="stack-lg">
      <LiveRefresh storeId={store.id} />
      {flash && <p className={`notice ${sp.erro ? 'notice-error' : 'notice-ok'}`} role={sp.erro ? 'alert' : 'status'}>{flash}</p>}

      <div className="tiles">
        <div className="tile"><span className="tile-label">Unidades em estoque</span><strong className="tile-value">{nf.format(totals.units)}</strong><span className="tile-hint">{nf.format(totals.products)} peças</span></div>
        <div className="tile"><span className="tile-label">Reservadas</span><strong className="tile-value">{nf.format(totals.reserved)}</strong><span className="tile-hint">{totals.reservations} reserva(s) ativa(s)</span></div>
        <div className="tile"><span className="tile-label">Livres para vender</span><strong className="tile-value">{nf.format(totals.available)}</strong></div>
        <Link href={href({ f: 'low' })} className={`tile${totals.low + totals.out > 0 ? ' tile-warn' : ''}`}>
          <span className="tile-label">Atenção</span><strong className="tile-value">{totals.low + totals.out}</strong>
          <span className="tile-hint">{totals.low} poucas · {totals.out} esgotadas</span>
        </Link>
      </div>

      <form className="row search" role="search" action={here}>
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por nome ou código" aria-label="Buscar no estoque" />
        {filter !== 'all' && <input type="hidden" name="f" value={filter} />}
        <button className="btn btn-ghost" type="submit">Buscar</button>
      </form>
      <nav className="subnav wrap" aria-label="Filtrar estoque">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <Link key={f} href={href({ f })} aria-current={f === filter ? 'page' : undefined}>{FILTERS[f]}</Link>
        ))}
      </nav>

      {(totalsRes.error || rowsRes.error) && <p className="notice notice-error" role="alert">Não foi possível carregar o estoque. Atualize a página.</p>}
      {!rowsRes.error && rows.length === 0 && (
        <div className="card empty">
          <h2>{q || filter !== 'all' ? 'Nada encontrado com esse filtro.' : 'Você ainda não cadastrou nenhuma peça.'}</h2>
          {(q || filter !== 'all') && <Link href={here} className="btn btn-ghost">Limpar filtros</Link>}
          {!q && filter === 'all' && can(role, 'edit_products') && <Link href={`/app/${slug}/produtos/novo`} className="btn btn-primary">Adicionar produto</Link>}
        </div>
      )}

      <ul className="list">
        {rows.map((r) => (
          <li key={r.product_id} className={`stock-row stock-${r.stock_state}`}>
            <div className="stock-main">
              <Link href={`/app/${slug}/produtos/${r.product_id}`} className="product-name">{r.name}</Link>
              <span className="muted small">{r.sku ? `Cód. ${r.sku}` : 'Sem código'}</span>
              <div className="stock-numbers" aria-label={`${r.quantity} em estoque, ${r.reserved} reservadas, ${Math.max(r.available, 0)} livres`}>
                <span><strong>{r.quantity}</strong> em estoque</span>
                <span><strong>{r.reserved}</strong> reservadas</span>
                <span><strong>{Math.max(r.available, 0)}</strong> livres</span>
                <span className={`badge${r.stock_state === 'ok' ? '' : r.stock_state === 'reserved' ? ' badge-auto' : ' badge-warn'}`}>{STATE_LABEL[r.stock_state]}</span>
              </div>
              {demand.has(r.product_id) && (demand.get(r.product_id)!.waiting + demand.get(r.product_id)!.contacted + demand.get(r.product_id)!.clicks_30d) > 0 && (
                <Link href={`/app/${slug}/interessados?produto=${r.product_id}`} className="small link">
                  🔔 {demand.get(r.product_id)!.waiting + demand.get(r.product_id)!.contacted} na lista · {demand.get(r.product_id)!.clicks_30d} pedidos de aviso (30 dias)
                </Link>
              )}
              {r.reservations.length > 0 && (
                <ul className="stock-res">
                  {r.reservations.map((x) => (
                    <li key={x.id}>
                      <strong>{x.customer}</strong> × {x.quantity}{x.size ? ` (${x.size})` : ''}
                      <span className="muted small"> — reservado por {x.by || 'equipe'} {timeAgo(x.at)}{x.expires_at ? ` · até ${new Date(x.expires_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}{x.status === 'requested' ? ' · aguardando confirmação' : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {editable && (
              <div className="stock-actions">
                <form action={adjustStockAction.bind(null, slug, r.product_id)} className="row">
                  <input type="hidden" name="back" value={here} />
                  <input type="number" name="qty" min={1} max={99999} defaultValue={1} inputMode="numeric" aria-label={`Quantidade para ${r.name}`} className="qty" />
                  <button className="btn btn-ghost" name="op" value="restock" type="submit">+ Entrada</button>
                  <button className="btn btn-ghost" name="op" value="sale" type="submit">− Venda</button>
                </form>
                <Link href={`/app/${slug}/reservas/nova?produto=${r.product_id}`} className="btn btn-ghost">Reservar</Link>
              </div>
            )}
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <nav className="row spread" aria-label="Páginas">
          {page > 1 ? <Link className="btn btn-ghost" href={href({ page: page - 1 })}>← Anterior</Link> : <span />}
          <span className="muted small">Página {page} de {pages}</span>
          {page < pages ? <Link className="btn btn-ghost" href={href({ page: page + 1 })}>Próxima →</Link> : <span />}
        </nav>
      )}

      <section className="card stack" aria-labelledby="feed-h">
        <h2 id="feed-h">O que está acontecendo</h2>
        {feed.length === 0 ? <p className="muted">Quando a equipe mexer no estoque ou criar reservas, aparece aqui na hora.</p> : (
          <ul className="activity">
            {feed.map((m) => (
              <li key={m.id}>
                <span className="muted small">{timeAgo(m.created_at)}</span>
                <span>{describeMovement(m)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
