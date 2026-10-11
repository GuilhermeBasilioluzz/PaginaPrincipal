import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProductForm, type ProductFormValues } from '@/components/ProductForm'
import { ConfirmButton } from '@/components/ConfirmButton'
import { SubmitButton } from '@/components/ui'
import { normalizeFilters } from '@/lib/catalogFilters'
import { can } from '@/lib/permissions'
import { formatInput } from '@/lib/money'
import { splitSizes } from '@/lib/sizes'
import { getMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { PhotoManager, type PhotoItem } from '@/components/PhotoManager'
import { setProductCollectionsAction } from '../../colecoes/actions'
import { adjustStockAction, setStockAction } from '../../estoque/actions'
import { describeMovement, type FeedItem } from '@/lib/stock'
import { describeActivity, type ActivityItem } from '@/lib/activity'
import { STOCK_FLASH } from '@/lib/flash'
import { timeAgo } from '@/lib/dashboard'
import { archiveProductAction, deleteProductAction, duplicateProductAction, restoreProductAction } from '../actions'

export const metadata = { title: 'Editar produto' }

const FLASH: Record<string, string> = { ...STOCK_FLASH, collections: 'Coleções da peça atualizadas.', forbidden: 'Você não tem permissão para fazer isso.', created: 'Produto criado! Agora adicione as fotos abaixo.', duplicated: 'Cópia criada. Ela está como indisponível: revise os dados, informe o estoque e publique.' }

export default async function EditProductPage({ params, searchParams }: {
  params: Promise<{ store: string; id: string }>
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const [{ store: slug, id }, { ok, erro }] = await Promise.all([params, searchParams])
  const membership = await getMembership(slug)
  if (!membership || !/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { store, role } = membership

  const supabase = await createClient()
  const { data: p } = await supabase.from('products').select('*').eq('id', id).eq('store_id', store.id).maybeSingle()
  if (!p) notFound()
  const [{ data: inv }, { data: categories }, { data: photos }, { data: manualCols }, { data: memberOf }, { data: activeRes }, { data: history }, { data: log }, { data: st }] = await Promise.all([
    supabase.from('inventory').select('quantity').eq('product_id', id).maybeSingle(),
    supabase.from('categories').select('id, name').eq('store_id', store.id).order('position').order('name'),
    supabase.from('product_images').select('id, path, kind, alt').eq('product_id', id).order('position'),
    supabase.from('collections').select('id, name').eq('store_id', store.id).eq('kind', 'manual').order('name'),
    supabase.from('collection_products').select('collection_id').eq('product_id', id),
    supabase.from('reservations').select('quantity, expires_at').eq('product_id', id).in('status', ['requested', 'confirmed']),
    supabase.rpc('store_stock_feed', { p_store: store.id, p_limit: 10, p_product: id }),
    supabase.rpc('store_activity', { p_store: store.id, p_actor: null, p_type: 'product', p_entity: id, p_limit: 10, p_offset: 0 }),
    supabase.from('stores').select('catalog_filters').eq('id', store.id).maybeSingle(),
  ])
  const who = new Map<string, string>()
  const ids = [p.created_by, p.updated_by].filter((x): x is string => !!x)
  if (ids.length) for (const r of (await supabase.from('profiles').select('id, full_name').in('id', ids)).data ?? []) who.set(r.id, r.full_name || 'Alguém da equipe')
  const day = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const now = Date.now()
  const reservedQty = (activeRes ?? []).filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now).reduce((a, r) => a + r.quantity, 0)
  const onHand = inv?.quantity ?? 0
  const here = `/app/${slug}/produtos/${id}`
  const inCollections = new Set((memberOf ?? []).map((m) => m.collection_id))

  const { checked, extra } = splitSizes(p.sizes ?? [])
  const initial: ProductFormValues = {
    name: p.name, price: formatInput(p.price), promo: formatInput(p.promo_price), quantity: String(inv?.quantity ?? 0),
    color: p.color ?? '', sku: p.sku ?? '', description: p.description ?? '', video: p.video_url ?? '',
    status: p.status === 'archived' ? 'unavailable' : p.status, category: p.category_id ?? '', featured: p.is_featured,
    sizes: checked, sizesExtra: extra, audience: p.audience, styles: p.styles ?? [],
  }
  const filters = normalizeFilters(st?.catalog_filters)
  const editable = can(role, 'edit_products') && store.is_active
  const archived = p.status === 'archived'

  return (
    <div className="narrow stack-lg">
      {erro && FLASH[erro] && <p className="notice notice-error" role="alert">{FLASH[erro]}</p>}
      {ok && FLASH[ok] && <p className="notice notice-ok" role="status">{FLASH[ok]}</p>}
      <div className="card">
        <Link href={`/app/${slug}/produtos`} className="link small">← Produtos</Link>
        <h1>{p.name}</h1>
        <p className="muted small">Endereço do produto: <code>/{slug}/produto/{p.slug}</code></p>
        <p className="muted small" data-testid="autoria">
          Cadastrada {p.created_by ? `por ${who.get(p.created_by) ?? 'alguém da equipe'}` : ''} em {day(p.created_at)}
          {p.updated_by && <> · Última alteração por <strong>{who.get(p.updated_by) ?? 'alguém da equipe'}</strong> em {day(p.updated_at)}</>}
        </p>
        {archived && <p className="notice notice-error">Este produto está arquivado e fora do catálogo.</p>}
        {editable
          ? <ProductForm storeId={store.id} slug={slug} productId={id} initial={initial} categories={categories ?? []} archived={archived} filters={filters} />
          : <p className="notice">Você só pode consultar este produto.</p>}
      </div>

      <div className="card">
        <PhotoManager storeId={store.id} slug={slug} productId={id} productName={p.name} supabaseUrl={getSupabaseEnv()?.url ?? ''}
          photos={(photos ?? []) as PhotoItem[]} canEdit={editable} />
      </div>

      <section className="card stack" aria-labelledby="estoque-h">
        <h2 id="estoque-h">Estoque</h2>
        <div className="tiles tiles-3">
          <div className="tile"><span className="tile-label">Em estoque</span><strong className="tile-value">{onHand}</strong></div>
          <div className="tile"><span className="tile-label">Reservadas</span><strong className="tile-value">{reservedQty}</strong></div>
          <div className="tile"><span className="tile-label">Livres</span><strong className="tile-value">{Math.max(onHand - reservedQty, 0)}</strong></div>
        </div>
        {editable && (
          <>
            <form action={adjustStockAction.bind(null, slug, id)} className="row">
              <input type="hidden" name="back" value={here} />
              <input type="number" name="qty" min={1} max={99999} defaultValue={1} inputMode="numeric" aria-label="Quantidade" className="qty" />
              <button className="btn btn-ghost" name="op" value="restock" type="submit">+ Entrada</button>
              <button className="btn btn-ghost" name="op" value="sale" type="submit">− Venda</button>
              <button className="btn btn-ghost" name="op" value="return" type="submit">Devolução</button>
            </form>
            <form action={setStockAction.bind(null, slug, id)} className="row">
              <input type="hidden" name="back" value={here} />
              <input type="number" name="quantity" min={0} max={99999} defaultValue={onHand} inputMode="numeric" aria-label="Quantidade contada" className="qty" />
              <SubmitButton variant="ghost">Corrigir pela contagem</SubmitButton>
              <Link href={`/app/${slug}/reservas/nova?produto=${id}`} className="btn btn-ghost">Reservar para uma cliente</Link>
            </form>
          </>
        )}
        <h3 style={{ margin: '0.5rem 0 0', fontSize: '1rem' }}>Histórico da peça</h3>
        {((history ?? []) as FeedItem[]).length === 0 ? <p className="muted small">Nenhuma movimentação ainda.</p> : (
          <ul className="activity">
            {((history ?? []) as FeedItem[]).map((m) => (
              <li key={m.id}><span className="muted small">{timeAgo(m.created_at)}</span><span>{describeMovement(m)}</span></li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="quem-h">
        <h2 id="quem-h">Quem mexeu nesta peça</h2>
        {((log ?? []) as ActivityItem[]).length === 0 ? <p className="muted small">Nenhuma atividade registrada que você possa ver.</p> : (
          <ul className="activity">
            {((log ?? []) as ActivityItem[]).map((a) => (
              <li key={a.id}><span className="muted small">{timeAgo(a.created_at)}</span><span>{describeActivity({ action: a.action, entity_name: a.entity_name, details: a.details, actor_name: a.actor_name })}</span></li>
            ))}
          </ul>
        )}
        <p className="muted small">Dono e gerente veem toda a equipe; atendente vê só as próprias ações. <Link href={`/app/${slug}/atividades`} className="link">Ver todas as atividades</Link></p>
      </section>

      <div className="card stack">
        <h2>Coleções</h2>
        {(manualCols ?? []).length === 0 ? (
          <p className="muted small">
            Ainda não há coleções.{' '}
            {can(role, 'manage_structure') && <Link href={`/app/${slug}/colecoes/nova`} className="link">Criar a primeira</Link>}
          </p>
        ) : (
          <form action={setProductCollectionsAction.bind(null, slug, id)} className="stack">
            <div className="chip-row">
              {(manualCols ?? []).map((c) => (
                <label key={c.id} className="check">
                  <input type="checkbox" name="collections" value={c.id} defaultChecked={inCollections.has(c.id)} disabled={!editable} /> {c.name}
                </label>
              ))}
            </div>
            {editable && <div><SubmitButton variant="ghost">Salvar coleções</SubmitButton></div>}
          </form>
        )}
        <p className="muted small">A coleção automática "Novidades" inclui esta peça sozinha pelos dias desde que foi adicionada.</p>
      </div>

      {editable && (
        <div className="card stack">
          <h2>Outras ações</h2>
          <div className="row">
            <form action={duplicateProductAction.bind(null, store.id, slug, id)}><SubmitButton variant="ghost">Duplicar produto</SubmitButton></form>
            {archived
              ? <form action={restoreProductAction.bind(null, slug, id)}><SubmitButton variant="ghost">Restaurar</SubmitButton></form>
              : <form action={archiveProductAction.bind(null, slug, id)}><SubmitButton variant="ghost">Arquivar</SubmitButton></form>}
            {can(role, 'delete_products') && (
              <form action={deleteProductAction.bind(null, slug, id)}>
                <ConfirmButton message="Excluir este produto de vez? Isso apaga também estoque e fotos e não pode ser desfeito. Para só tirar do catálogo, use Arquivar.">Excluir</ConfirmButton>
              </form>
            )}
          </div>
          <p className="muted small">Arquivar guarda o histórico e tira a peça do catálogo. Só donos e gerentes podem excluir.</p>
        </div>
      )}
    </div>
  )
}
