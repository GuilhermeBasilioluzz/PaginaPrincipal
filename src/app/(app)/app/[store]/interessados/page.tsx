import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LiveRefresh } from '@/components/LiveRefresh'
import { ConfirmButton } from '@/components/ConfirmButton'
import { Field, SubmitButton } from '@/components/ui'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/session'
import { can } from '@/lib/permissions'
import { INTEREST_FLASH } from '@/lib/flash'
import { PAGE_SIZE, pageNumber } from '@/lib/products'
import { timeAgo } from '@/lib/dashboard'
import { siteUrl } from '@/lib/supabase/env'
import { formatWhatsapp } from '@/lib/storeSettings'
import { STATE_LABEL, type StockRow } from '@/lib/stock'
import {
  INTEREST_LABEL, productUrl, restockWhatsappUrl, restockedWithDemand, type InterestOverviewRow, type InterestRow,
} from '@/lib/interest'
import { addInterestAction, deleteInterestAction, setInterestStatusAction } from './actions'

export const metadata = { title: 'Interessadas' }

const TABS = { open: 'Em aberto', converted: 'Venderam', dismissed: 'Dispensadas', all: 'Todas' } as const
type Tab = keyof typeof TABS
const UUID = /^[0-9a-f-]{36}$/i

export default async function InterestsPage({ params, searchParams }: {
  params: Promise<{ store: string }>
  searchParams: Promise<{ produto?: string; tab?: string; page?: string; ok?: string; erro?: string }>
}) {
  const [{ store: slug }, sp] = await Promise.all([params, searchParams])
  const membership = await getMembership(slug)
  if (!membership) notFound()
  const { store, role } = membership
  const editable = can(role, 'update_stock') && store.is_active
  const canDelete = can(role, 'delete_products') && store.is_active
  const productId = sp.produto && UUID.test(sp.produto) ? sp.produto : null
  const tab: Tab = sp.tab && sp.tab in TABS ? (sp.tab as Tab) : 'open'
  const page = pageNumber(sp.page)

  const supabase = await createClient()
  const [overviewRes, listRes, productsRes] = await Promise.all([
    supabase.rpc('store_interest_overview', { p_store: store.id }),
    supabase.rpc('store_interests', { p_store: store.id, p_product: productId, p_status: tab, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    supabase.rpc('store_stock_overview', { p_store: store.id, p_filter: 'all', p_q: '', p_limit: 100, p_offset: 0 }),
  ])
  const overview = (overviewRes.data ?? []) as InterestOverviewRow[]
  const people = (listRes.data ?? []) as InterestRow[]
  const products = ((productsRes.data ?? []) as StockRow[]).sort((a, b) => Number(b.stock_state === 'out') - Number(a.stock_state === 'out') || a.name.localeCompare(b.name, 'pt-BR'))
  const total = people[0] ? Number(people[0].total) : 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const flash = (sp.erro && INTEREST_FLASH[sp.erro]) || (sp.ok && INTEREST_FLASH[sp.ok]) || null
  const restocked = restockedWithDemand(overview)
  const filteredName = productId ? overview.find((o) => o.product_id === productId)?.name ?? products.find((p) => p.product_id === productId)?.name : null
  const href = (o: { produto?: string | null; tab?: Tab; page?: number }) => {
    const u = new URLSearchParams()
    const pr = o.produto === undefined ? productId : o.produto
    if (pr) u.set('produto', pr)
    const t = o.tab ?? tab
    if (t !== 'open') u.set('tab', t)
    if ((o.page ?? 1) > 1) u.set('page', String(o.page))
    return `/app/${slug}/interessados${u.size ? `?${u}` : ''}`
  }

  return (
    <div className="stack-lg">
      <LiveRefresh storeId={store.id} />
      {flash && <p className={`notice ${sp.erro ? 'notice-error' : 'notice-ok'}`} role={sp.erro ? 'alert' : 'status'}>{flash}</p>}

      <div>
        <h2 style={{ margin: 0 }}>Interessadas em peças esgotadas</h2>
        <p className="muted small">
          Cada clique em "Avise-me quando chegar" na página da peça abre o WhatsApp da loja. Quando alguém chamar, anote aqui para
          avisar com um toque quando a peça voltar. Os cliques medem a demanda mesmo de quem não chamou.
        </p>
      </div>

      {restocked.length > 0 && (
        <section className="card stack" style={{ borderColor: 'var(--bronze)' }} aria-labelledby="back-h">
          <h2 id="back-h">🔔 Voltaram ao estoque: avise quem esperava</h2>
          <ul className="list">
            {restocked.map((r) => (
              <li key={r.product_id} className="member">
                <span><strong>{r.name}</strong> <span className="muted small">— {r.waiting} {r.waiting === 1 ? 'pessoa esperando' : 'pessoas esperando'}</span></span>
                <Link href={href({ produto: r.product_id, tab: 'open' })} className="btn btn-primary">Ver quem avisar</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="stack" aria-labelledby="demand-h">
        <h2 id="demand-h" className="eyebrow">Demanda por peça</h2>
        {overview.length === 0 ? (
          <div className="card empty">
            <h2>Ainda não há pedidos de aviso.</h2>
            <p className="muted">Quando uma cliente tocar em "Avise-me quando chegar" numa peça esgotada, a demanda aparece aqui.</p>
          </div>
        ) : (
          <ul className="list">
            {overview.map((r) => {
              const sizes = Object.entries(r.sizes ?? {})
              return (
                <li key={r.product_id} className="stock-row">
                  <div className="stock-main">
                    <Link href={`/app/${slug}/produtos/${r.product_id}`} className="product-name">{r.name}</Link>
                    <div className="stock-numbers">
                      <span><strong>{r.clicks_30d}</strong> pedidos de aviso (30 dias)</span>
                      <span><strong>{r.waiting + r.contacted}</strong> na lista</span>
                      {r.converted > 0 && <span><strong>{r.converted}</strong> venderam</span>}
                      {r.stock_state && <span className={`badge${r.stock_state === 'ok' ? '' : r.stock_state === 'reserved' ? ' badge-auto' : ' badge-warn'}`}>{STATE_LABEL[r.stock_state]}</span>}
                    </div>
                    {sizes.length > 0 && <span className="muted small">Tamanhos pedidos: {sizes.map(([s, n]) => `${s} × ${n}`).join(' · ')}</span>}
                  </div>
                  <div className="stock-actions">
                    <Link href={href({ produto: r.product_id, tab: 'open' })} className="btn btn-ghost">Ver pessoas</Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {editable && (
        <details className="card advanced" open={productId ? true : undefined} id="anotar">
          <summary>+ Anotar interessada</summary>
          <form action={addInterestAction.bind(null, slug)} className="stack">
            <label className="field">
              <span className="field-label">Peça</span>
              <select name="product" defaultValue={productId ?? ''} required>
                <option value="" disabled>Escolha a peça…</option>
                {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.name} — {STATE_LABEL[p.stock_state]}</option>)}
              </select>
            </label>
            <div className="grid-2">
              <Field label="Nome da cliente" name="name" required maxLength={80} autoComplete="off" />
              <Field label="WhatsApp" name="contact" inputMode="tel" placeholder="(84) 99999-0000" required autoComplete="off" />
            </div>
            <div className="grid-2">
              <Field label="Tamanho (opcional)" name="size" maxLength={12} />
              <Field label="Observação (opcional)" name="note" maxLength={300} />
            </div>
            <div><SubmitButton pendingText="Anotando…">Anotar na lista</SubmitButton></div>
          </form>
        </details>
      )}

      <section className="stack" aria-labelledby="people-h">
        <div className="row spread">
          <h2 id="people-h" className="eyebrow" style={{ flex: 1 }}>Quem está esperando{filteredName ? `: ${filteredName}` : ''}</h2>
          {productId && <Link href={href({ produto: null })} className="link small">Ver todas as peças</Link>}
        </div>
        <nav className="subnav wrap" aria-label="Situação">
          {(Object.keys(TABS) as Tab[]).map((t) => <Link key={t} href={href({ tab: t })} aria-current={t === tab ? 'page' : undefined}>{TABS[t]}</Link>)}
        </nav>

        {people.length === 0 ? (
          <div className="card empty"><h2>{tab === 'open' ? 'Ninguém na lista.' : 'Nada por aqui.'}</h2></div>
        ) : (
          <ul className="list">
            {people.map((r) => {
              return (
                <li key={r.id} className="product-row">
                  <div className="product-main" style={{ gridColumn: '1 / -1' }}>
                    <span><strong>{r.customer_name}</strong> <span className="muted small">· {formatWhatsapp(r.contact)}{r.size ? ` · tamanho ${r.size}` : ''}</span></span>
                    <Link href={`/app/${slug}/produtos/${r.product_id}`} className="product-name">{r.product_name}</Link>
                    {r.note && <span className="muted small">“{r.note}”</span>}
                    <span className="muted small">Pediu {timeAgo(r.created_at)}{r.handled_by_name && r.handled_at ? ` · ${INTEREST_LABEL[r.status].toLowerCase()} por ${r.handled_by_name} ${timeAgo(r.handled_at)}` : ''}</span>
                  </div>
                  <div className="product-side" style={{ gridColumn: '1 / -1' }}>
                    <span className={`badge${r.status === 'dismissed' ? ' badge-warn' : r.status === 'converted' ? ' badge-auto' : ''}`}>{INTEREST_LABEL[r.status]}</span>
                  </div>
                  {editable && (
                    <div className="row product-actions" style={{ gridColumn: '1 / -1' }}>
                      <a className="btn btn-primary" target="_blank" rel="noopener noreferrer"
                        href={restockWhatsappUrl(r.contact, r.customer_name, r.product_name, store.name, productUrl(siteUrl(), slug, r.product_slug), r.size)}>Avisar no WhatsApp</a>
                      {r.status === 'waiting' && <form action={setInterestStatusAction.bind(null, slug, r.id, 'contacted')}><SubmitButton variant="ghost">Marcar como avisada</SubmitButton></form>}
                      {(r.status === 'waiting' || r.status === 'contacted') && (
                        <>
                          <Link className="btn btn-ghost" href={`/app/${slug}/reservas/nova?produto=${r.product_id}&cliente=${encodeURIComponent(r.customer_name)}&contato=${r.contact}&interesse=${r.id}`}>Reservar para ela</Link>
                          <form action={setInterestStatusAction.bind(null, slug, r.id, 'converted')}><SubmitButton variant="ghost">Virou venda</SubmitButton></form>
                          <form action={setInterestStatusAction.bind(null, slug, r.id, 'dismissed')}><SubmitButton variant="ghost">Dispensar</SubmitButton></form>
                        </>
                      )}
                      {(r.status === 'converted' || r.status === 'dismissed') && <form action={setInterestStatusAction.bind(null, slug, r.id, 'waiting')}><SubmitButton variant="ghost">Reabrir</SubmitButton></form>}
                      {canDelete && (
                        <form action={deleteInterestAction.bind(null, slug, r.id)}>
                          <ConfirmButton message={`Apagar ${r.customer_name} da lista? Use quando ela pedir a exclusão dos dados dela. Não dá para desfazer.`}>Apagar dados</ConfirmButton>
                        </form>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {pages > 1 && (
          <nav className="row spread" aria-label="Páginas">
            {page > 1 ? <Link className="btn btn-ghost" href={href({ page: page - 1 })}>← Anterior</Link> : <span />}
            <span className="muted small">Página {page} de {pages}</span>
            {page < pages ? <Link className="btn btn-ghost" href={href({ page: page + 1 })}>Próxima →</Link> : <span />}
          </nav>
        )}
      </section>
    </div>
  )
}
