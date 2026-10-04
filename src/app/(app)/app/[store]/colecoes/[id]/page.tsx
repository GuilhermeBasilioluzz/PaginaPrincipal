import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CollectionForm } from '@/components/CollectionForm'
import { ConfirmButton } from '@/components/ConfirmButton'
import { Field, SubmitButton } from '@/components/ui'
import { can } from '@/lib/permissions'
import { STATUS_LABEL, type ProductStatus } from '@/lib/dashboard'
import { formatBRL } from '@/lib/money'
import { searchTerm } from '@/lib/products'
import { getMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { COLLECTION_FLASH } from '@/lib/flash'
import {
  addProductsToCollectionAction, deleteCollectionAction, removeProductFromCollectionAction, saveCollectionAction,
} from '../actions'

export const metadata = { title: 'Coleção' }

type Item = { id: string; name: string; price: number; status: ProductStatus }

export default async function CollectionPage({ params, searchParams }: {
  params: Promise<{ store: string; id: string }>; searchParams: Promise<{ ok?: string; erro?: string; q?: string }>
}) {
  const [{ store: slug, id }, sp] = await Promise.all([params, searchParams])
  const membership = await getMembership(slug)
  if (!membership || !/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { store, role } = membership

  const supabase = await createClient()
  const { data: c } = await supabase.from('collections').select('*').eq('id', id).eq('store_id', store.id).maybeSingle()
  if (!c) notFound()

  const manageStructure = can(role, 'manage_structure') && store.is_active
  const arrange = can(role, 'edit_products') && store.is_active && c.kind === 'manual'
  const flash = (sp.erro && COLLECTION_FLASH[sp.erro]) || (sp.ok && COLLECTION_FLASH[sp.ok]) || null

  // peças da coleção (mesma regra do catálogo público: collection_items)
  const { data: links } = await supabase.rpc('collection_items', { p_collection: id })
  const ids = (links ?? []).map((l: { product_id: string }) => l.product_id)
  const items: Item[] = []
  if (ids.length) {
    const { data: ps } = await supabase.from('products').select('id, name, price, status').in('id', ids)
    const byId = new Map((ps ?? []).map((p) => [p.id, p as Item]))
    for (const pid of ids) if (byId.has(pid)) items.push(byId.get(pid)!)
  }

  // peças que ainda não estão na coleção (para adicionar), com busca
  const q = searchTerm(sp.q)
  let candidates: Item[] = []
  if (arrange) {
    let query = supabase.from('products').select('id, name, price, status').eq('store_id', store.id).neq('status', 'archived')
      .order('updated_at', { ascending: false }).limit(30)
    if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
    const { data: all } = await query
    candidates = ((all ?? []) as Item[]).filter((p) => !ids.includes(p.id))
  }

  return (
    <div className="stack-lg">
      {flash && <p className={`notice ${sp.erro ? 'notice-error' : 'notice-ok'}`} role={sp.erro ? 'alert' : 'status'}>{flash}</p>}

      <div className="card">
        <Link href={`/app/${slug}/colecoes`} className="link small">← Coleções</Link>
        <h1>{c.name}</h1>
        <p className="muted small">
          Link da coleção: <code>/{slug}/colecao/{c.slug}</code>
          {!c.is_published && <> · <strong>Rascunho</strong> (não aparece no catálogo)</>}
          {c.kind === 'new_arrivals' && <> · Automática: peças dos últimos {c.new_arrivals_days} dias</>}
        </p>
        {manageStructure
          ? <CollectionForm action={saveCollectionAction.bind(null, store.id, slug, id)} cancelHref={`/app/${slug}/colecoes`} submitLabel="Salvar alterações"
              initial={{ name: c.name, description: c.description ?? '', kind: c.kind, days: String(c.new_arrivals_days ?? 7), published: c.is_published }} />
          : c.description && <p>{c.description}</p>}
      </div>

      <div className="card stack">
        <h2>Peças da coleção <span className="muted small">({items.length})</span></h2>
        {items.length === 0 ? (
          <p className="muted">
            {c.kind === 'new_arrivals' ? 'Nenhuma peça foi adicionada nos últimos dias.' : 'Esta coleção ainda não tem peças. Adicione abaixo.'}
          </p>
        ) : (
          <ul className="list">
            {items.map((p) => (
              <li key={p.id} className="member">
                <div>
                  <Link href={`/app/${slug}/produtos/${p.id}`} className="product-name">{p.name}</Link>{' '}
                  <span className="muted small">{formatBRL(p.price)}</span>{' '}
                  <span className="badge">{STATUS_LABEL[p.status]}</span>
                </div>
                {arrange && (
                  <form action={removeProductFromCollectionAction.bind(null, slug, id, p.id)}>
                    <SubmitButton variant="ghost">Tirar da coleção</SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {arrange && (
        <div className="card stack">
          <h2>Adicionar peças</h2>
          <form className="row search" role="search" action={`/app/${slug}/colecoes/${id}`}>
            <input type="search" name="q" defaultValue={q} placeholder="Buscar por nome ou código" aria-label="Buscar peças" />
            <button className="btn btn-ghost" type="submit">Buscar</button>
          </form>
          {candidates.length === 0 ? (
            <p className="muted">{q ? 'Nenhuma peça encontrada.' : 'Todas as suas peças já estão nesta coleção.'}</p>
          ) : (
            <form action={addProductsToCollectionAction.bind(null, slug, id)} className="stack">
              <ul className="list">
                {candidates.map((p) => (
                  <li key={p.id}>
                    <label className="member check">
                      <span><input type="checkbox" name="product" value={p.id} /> {p.name}{' '}
                        <span className="muted small">{formatBRL(p.price)} · {STATUS_LABEL[p.status]}</span></span>
                    </label>
                  </li>
                ))}
              </ul>
              <SubmitButton pendingText="Adicionando…">Adicionar marcadas</SubmitButton>
            </form>
          )}
        </div>
      )}

      {manageStructure && c.slug !== 'novidades' && (
        <div className="card stack">
          <h2>Excluir coleção</h2>
          <p className="muted small">As peças não são apagadas: só deixam de pertencer a esta coleção.</p>
          <form action={deleteCollectionAction.bind(null, slug, id)}>
            <ConfirmButton message={`Excluir a coleção "${c.name}"? As peças continuam no catálogo.`}>Excluir coleção</ConfirmButton>
          </form>
        </div>
      )}
    </div>
  )
}
