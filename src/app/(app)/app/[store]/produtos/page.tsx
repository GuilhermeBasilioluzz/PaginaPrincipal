import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/session'
import { can } from '@/lib/permissions'
import { STATUS_LABEL, type ProductStatus } from '@/lib/dashboard'
import { formatBRL } from '@/lib/money'
import { PAGE_SIZE, listFilter, pageNumber, searchTerm, type ListFilter } from '@/lib/products'
import { SubmitButton } from '@/components/ui'
import { archiveProductAction, duplicateProductAction, restoreProductAction } from './actions'

export const metadata = { title: 'Produtos' }

const FLASH: Record<string, string> = {
  created: 'Produto criado.', saved: 'Alterações salvas.', duplicated: 'Cópia criada. Revise os dados e publique.',
  archived: 'Produto arquivado.', restored: 'Produto restaurado como indisponível. Revise e publique.', deleted: 'Produto excluído.',
  forbidden: 'Você não tem permissão para fazer isso.', not_found: 'Este produto não existe mais.', generic: 'Algo deu errado. Tente novamente.',
}
const FILTER_LABEL: Record<ListFilter, string> = {
  all: 'Todos', available: 'Disponíveis', reserved: 'Reservados', sold: 'Vendidos', unavailable: 'Indisponíveis', archived: 'Arquivados',
}

type Row = {
  id: string; name: string; price: number; promo_price: number | null; status: ProductStatus
  color: string | null; sizes: string[]; sku: string | null; is_featured: boolean
}

export default async function ProductsPage({ params, searchParams }: {
  params: Promise<{ store: string }>
  searchParams: Promise<{ q?: string; status?: string; page?: string; ok?: string; erro?: string }>
}) {
  const [{ store: slug }, sp] = await Promise.all([params, searchParams])
  const membership = await getMembership(slug)
  if (!membership) notFound()
  const { store, role } = membership
  const editable = can(role, 'edit_products') && store.is_active

  const q = searchTerm(sp.q)
  const filter = listFilter(sp.status)
  const page = pageNumber(sp.page)
  const from = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  let query = supabase
    .from('products')
    .select('id, name, price, promo_price, status, color, sizes, sku, is_featured', { count: 'exact' })
    .eq('store_id', store.id)
    .order('updated_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  query = filter === 'all' ? query.neq('status', 'archived') : query.eq('status', filter)
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`)

  const { data, count, error } = await query
  const rows = (data ?? []) as Row[]
  const stock = new Map<string, number>()
  if (rows.length) {
    const { data: inv } = await supabase.from('inventory').select('product_id, quantity').in('product_id', rows.map((r) => r.id))
    for (const i of inv ?? []) stock.set(i.product_id, i.quantity)
  }

  const total = count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const flash = (sp.erro && FLASH[sp.erro]) || (sp.ok && FLASH[sp.ok]) || null
  const href = (over: { page?: number; status?: string }) => {
    const u = new URLSearchParams()
    if (q) u.set('q', q)
    const st = over.status ?? filter
    if (st !== 'all') u.set('status', st)
    if ((over.page ?? 1) > 1) u.set('page', String(over.page))
    const s = u.toString()
    return `/app/${slug}/produtos${s ? `?${s}` : ''}`
  }

  return (
    <div className="stack-lg">
      {flash && <p className={`notice ${sp.erro ? 'notice-error' : 'notice-ok'}`} role={sp.erro ? 'alert' : 'status'}>{flash}</p>}

      <div className="row spread">
        <h2 style={{ margin: 0 }}>Produtos <span className="muted small">({total})</span></h2>
        {editable && <Link href={`/app/${slug}/produtos/novo`} className="btn btn-primary">+ Adicionar produto</Link>}
      </div>

      <form className="row search" role="search" action={`/app/${slug}/produtos`}>
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por nome ou código" aria-label="Buscar produtos" />
        {filter !== 'all' && <input type="hidden" name="status" value={filter} />}
        <button className="btn btn-ghost" type="submit">Buscar</button>
      </form>

      <nav className="subnav wrap" aria-label="Filtrar por situação">
        {(Object.keys(FILTER_LABEL) as ListFilter[]).map((f) => (
          <Link key={f} href={href({ status: f })} aria-current={f === filter ? 'page' : undefined}>{FILTER_LABEL[f]}</Link>
        ))}
      </nav>

      {error && <p className="notice notice-error" role="alert">Não foi possível carregar os produtos. Atualize a página.</p>}

      {!error && rows.length === 0 && (
        <div className="card empty">
          {q || filter !== 'all' ? (
            <>
              <h2>Nenhum produto encontrado.</h2>
              <p className="muted">Tente outra busca ou limpe os filtros.</p>
              <Link href={`/app/${slug}/produtos`} className="btn btn-ghost">Limpar filtros</Link>
            </>
          ) : (
            <>
              <h2>Você ainda não cadastrou nenhuma peça.</h2>
              <p className="muted">Adicione a primeira peça para montar o catálogo da sua loja.</p>
              {editable && <Link href={`/app/${slug}/produtos/novo`} className="btn btn-primary">Adicionar produto</Link>}
            </>
          )}
        </div>
      )}

      <ul className="list">
        {rows.map((p) => {
          const qty = stock.get(p.id) ?? 0
          return (
            <li key={p.id} className="product-row">
              <div className="product-main">
                <Link href={`/app/${slug}/produtos/${p.id}`} className="product-name">{p.name}</Link>
                <span className="muted small">
                  {[p.color, p.sizes.length ? p.sizes.join(' · ') : null, p.sku ? `Cód. ${p.sku}` : null].filter(Boolean).join(' — ') || 'Sem detalhes'}
                </span>
                <span className="product-price">
                  {p.promo_price != null ? (<><s className="muted">{formatBRL(p.price)}</s> <strong>{formatBRL(p.promo_price)}</strong></>) : <strong>{formatBRL(p.price)}</strong>}
                </span>
              </div>
              <div className="product-side">
                <span className="badge">{STATUS_LABEL[p.status]}</span>
                {p.is_featured && <span className="badge">Destaque</span>}
                <span className={`badge${qty === 0 ? ' badge-warn' : ''}`}>{qty === 0 ? 'Sem estoque' : `${qty} un.`}</span>
              </div>
              {editable && (
                <div className="row product-actions">
                  <Link href={`/app/${slug}/produtos/${p.id}`} className="btn btn-ghost">Editar</Link>
                  <form action={duplicateProductAction.bind(null, store.id, slug, p.id)}><SubmitButton variant="ghost">Duplicar</SubmitButton></form>
                  {p.status === 'archived'
                    ? <form action={restoreProductAction.bind(null, slug, p.id)}><SubmitButton variant="ghost">Restaurar</SubmitButton></form>
                    : <form action={archiveProductAction.bind(null, slug, p.id)}><SubmitButton variant="ghost">Arquivar</SubmitButton></form>}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {pages > 1 && (
        <nav className="row spread" aria-label="Páginas">
          {page > 1 ? <Link className="btn btn-ghost" href={href({ page: page - 1 })}>← Anterior</Link> : <span />}
          <span className="muted small">Página {page} de {pages}</span>
          {page < pages ? <Link className="btn btn-ghost" href={href({ page: page + 1 })}>Próxima →</Link> : <span />}
        </nav>
      )}
    </div>
  )
}
